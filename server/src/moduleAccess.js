const { pool } = require("./db");

/** Admins reach every module; members only ones granted to them, and only
 *  while both the module and the grant are active. */
async function canReachModule(user, moduleId) {
  if (user.role === "admin") {
    const { rows } = await pool.query("SELECT 1 FROM modules WHERE id = $1", [moduleId]);
    return rows.length > 0;
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM modules m
     JOIN module_access ma ON ma.module_id = m.id
     WHERE m.id = $1 AND ma.user_id = $2 AND m.active`,
    [moduleId, user.id]
  );
  return rows.length > 0;
}

async function moduleIdForSection(sectionId) {
  const { rows } = await pool.query("SELECT module_id FROM sections WHERE id = $1", [sectionId]);
  return rows[0]?.module_id ?? null;
}

async function moduleIdForField(fieldId) {
  const { rows } = await pool.query(
    "SELECT s.module_id FROM fields f JOIN sections s ON s.id = f.section_id WHERE f.id = $1",
    [fieldId]
  );
  return rows[0]?.module_id ?? null;
}

async function moduleIdForRecord(recordId) {
  const { rows } = await pool.query(
    "SELECT s.module_id FROM records r JOIN sections s ON s.id = r.section_id WHERE r.id = $1",
    [recordId]
  );
  return rows[0]?.module_id ?? null;
}

/** Wraps a handler so it only runs when the caller can reach the module that
 *  owns the thing being touched. `resolve` maps the request to a module id. */
function withModuleAccess(resolve) {
  return async (req, res, next) => {
    const moduleId = await resolve(req);
    if (moduleId === null) return res.status(404).json({ error: "Not found." });
    if (!(await canReachModule(req.user, moduleId))) {
      return res.status(403).json({ error: "You don't have access to that module." });
    }
    req.moduleId = moduleId;
    next();
  };
}

module.exports = {
  canReachModule,
  moduleIdForSection,
  moduleIdForField,
  moduleIdForRecord,
  withModuleAccess,
};
