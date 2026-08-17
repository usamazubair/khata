const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { verifyPassword, signToken, publicUser, requireAuth, hashPassword } = require("../auth");

const router = express.Router();

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  const user = rows[0];
  // Same message whether the email is unknown or the password is wrong, so the
  // response can't be used to discover which accounts exist.
  const invalid = { error: "That email and password don't match." };
  if (!user) return res.status(401).json(invalid);
  if (!(await verifyPassword(password, user.password_hash))) return res.status(401).json(invalid);
  if (!user.active) return res.status(403).json({ error: "This account has been deactivated." });

  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(publicUser(req.user));
}));

router.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  if (!(await verifyPassword(current_password, req.user.password_hash))) {
    return res.status(401).json({ error: "Your current password isn't right." });
  }
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(new_password), req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
