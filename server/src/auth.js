const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const TOKEN_TTL = "30d"; // personal app on a personal phone — long sessions are fine

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set. Add it to .env / your host's environment.");
  return secret;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret(), { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active };
}

// Verifies the bearer token and re-reads the user, so a deactivated or deleted
// account stops working immediately rather than lasting until the token expires.
async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in to continue." });

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret());
  } catch {
    return res.status(401).json({ error: "Your session expired. Sign in again." });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [payload.sub]);
  const user = rows[0];
  if (!user || !user.active) return res.status(401).json({ error: "This account is no longer active." });

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only an admin can do that." });
  }
  next();
}

// Creates the first admin from env vars when the users table is empty, so a
// fresh deploy (Render free tier has no shell) can be signed into.
async function bootstrapAdmin() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM users");
  if (rows[0].total > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.");
    return;
  }

  await pool.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')",
    [email.toLowerCase().trim(), await hashPassword(password), process.env.ADMIN_NAME || "Admin"]
  );
  console.log(`Created first admin: ${email}`);
}

module.exports = { hashPassword, verifyPassword, signToken, publicUser, requireAuth, requireAdmin, bootstrapAdmin };
