const { pool } = require("./db");

/** Admins reach every module; members only ones granted to them, and only
 *  while both the module and the grant are active. */
async function canReachModule(user, slug) {
  if (user.role === "admin") return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM modules m
     JOIN module_access ma ON ma.module_id = m.id
     WHERE m.slug = $1 AND ma.user_id = $2 AND m.active`,
    [slug, user.id]
  );
  return rows.length > 0;
}

/** Gate a module's routes behind its access grant, so turning a module off for
 *  someone on the Users page actually blocks its endpoints — not just hides
 *  the card. */
function requireModule(slug) {
  return async (req, res, next) => {
    if (await canReachModule(req.user, slug)) return next();
    res.status(403).json({ error: "You don't have access to that module." });
  };
}

module.exports = { canReachModule, requireModule };
