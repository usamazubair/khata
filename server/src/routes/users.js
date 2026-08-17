const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { requireAdmin, hashPassword, publicUser } = require("../auth");

const router = express.Router();

router.use(requireAdmin);

// Each user carries the module ids they've been granted, so the admin page can
// render the access checkboxes without a second round trip.
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.active, u.created_at,
            COALESCE(ARRAY_AGG(ma.module_id) FILTER (WHERE ma.module_id IS NOT NULL), '{}') AS module_ids
     FROM users u
     LEFT JOIN module_access ma ON ma.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at`
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { email, password, name = "", role = "member", module_ids = [] } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Role must be admin or member." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [email.toLowerCase().trim(), await hashPassword(password), name, role]
    );
    const user = rows[0];
    for (const moduleId of module_ids) {
      await client.query("INSERT INTO module_access (user_id, module_id) VALUES ($1, $2)", [user.id, moduleId]);
    }
    await client.query("COMMIT");
    res.status(201).json({ ...publicUser(user), module_ids });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "A user with that email already exists." });
    throw err;
  } finally {
    client.release();
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { email, name, role, active, password, module_ids } = req.body;
  const id = Number(req.params.id);

  if (role && !["admin", "member"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin or member." });
  }
  // Guard against locking yourself out of the only admin account.
  if (id === req.user.id && (active === false || role === "member")) {
    return res.status(409).json({ error: "You can't deactivate or demote your own admin account." });
  }
  if (password && String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE users SET
         email = COALESCE($1, email),
         name = COALESCE($2, name),
         role = COALESCE($3, role),
         active = COALESCE($4, active),
         password_hash = COALESCE($5, password_hash)
       WHERE id = $6 RETURNING *`,
      [email ? email.toLowerCase().trim() : null, name, role, active, password ? await hashPassword(password) : null, id]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found." });
    }
    if (Array.isArray(module_ids)) {
      await client.query("DELETE FROM module_access WHERE user_id = $1", [id]);
      for (const moduleId of module_ids) {
        await client.query("INSERT INTO module_access (user_id, module_id) VALUES ($1, $2)", [id, moduleId]);
      }
    }
    await client.query("COMMIT");
    res.json(publicUser(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "A user with that email already exists." });
    throw err;
  } finally {
    client.release();
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ error: "You can't delete your own account." });
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "User not found." });
  res.status(204).end();
}));

module.exports = router;
