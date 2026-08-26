const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");
const { destroyAsset, isConfigured, signUpload } = require("../cloudinary");

const router = express.Router();

const SELECT = `
  SELECT e.*, ec.name AS category_name, ec.color AS category_color
  FROM exercises e
  JOIN exercise_categories ec ON ec.id = e.category_id
`;

/** Hands the client a short-lived signature so it can upload straight to
 *  Cloudinary. Behind the same auth + module gate as everything else, so a
 *  signature is never available to someone without Workout access. */
router.post("/upload-signature", asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Media uploads aren't configured — set the CLOUDINARY_* variables on the server.",
    });
  }
  const resourceType = req.body?.resource_type === "video" ? "video" : "image";
  res.json(signUpload({ resourceType }));
}));

router.get("/", asyncHandler(async (req, res) => {
  const { active, category_id, q } = req.query;
  const clauses = [];
  const params = [];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`e.active = $${params.length}`);
  }
  if (category_id) {
    params.push(Number(category_id));
    clauses.push(`e.category_id = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    clauses.push(`(e.name ILIKE $${params.length} OR ec.name ILIKE $${params.length} OR e.equipment ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `${SELECT} ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY e.sort_order, e.name`,
    params
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const {
    name,
    category_id,
    equipment = "",
    notes = "",
    active = true,
    media_url = null,
    media_public_id = null,
    media_type = null,
  } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Exercise name is required." });
  if (!category_id) return res.status(400).json({ error: "A category is required." });

  try {
    const { rows: last } = await pool.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM exercises");
    const { rows } = await pool.query(
      `INSERT INTO exercises (name, slug, category_id, equipment, notes, sort_order, active,
                              media_url, media_public_id, media_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        String(name).trim(),
        await uniqueSlug("exercises", name),
        category_id,
        equipment,
        notes,
        last[0].next,
        active,
        media_url,
        media_public_id,
        media_type,
      ]
    );
    const { rows: full } = await pool.query(`${SELECT} WHERE e.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "An exercise with that name already exists." });
    if (err.code === "23503") return res.status(400).json({ error: "That category doesn't exist." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, category_id, equipment, notes, sort_order, active, media_url, media_public_id, media_type } =
    req.body;

  const { rows: before } = await pool.query("SELECT * FROM exercises WHERE id = $1", [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Exercise not found." });

  // Media is only touched when the caller actually sends a media field, so an
  // ordinary edit (renaming, toggling active) can't wipe an attached clip.
  const touchingMedia = "media_url" in req.body || "media_public_id" in req.body;
  const slug = name ? await uniqueSlug("exercises", name, req.params.id) : null;

  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE exercises SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug),
         category_id = COALESCE($3, category_id),
         equipment = COALESCE($4, equipment),
         notes = COALESCE($5, notes),
         sort_order = COALESCE($6, sort_order),
         active = COALESCE($7, active),
         media_url = CASE WHEN $8::boolean THEN $9 ELSE media_url END,
         media_public_id = CASE WHEN $8::boolean THEN $10 ELSE media_public_id END,
         media_type = CASE WHEN $8::boolean THEN $11 ELSE media_type END
       WHERE id = $12 RETURNING *`,
      [
        name,
        slug,
        category_id ?? null,
        equipment,
        notes,
        sort_order,
        active,
        touchingMedia,
        media_url ?? null,
        media_public_id ?? null,
        media_type ?? null,
        req.params.id,
      ]
    ));
  } catch (err) {
    if (err.code === "23503") return res.status(400).json({ error: "That category doesn't exist." });
    throw err;
  }

  // Replacing or clearing media leaves the old file stranded on Cloudinary.
  const oldId = before[0].media_public_id;
  if (touchingMedia && oldId && oldId !== rows[0].media_public_id) {
    await destroyAsset(oldId, before[0].media_type ?? "image");
  }

  const { rows: full } = await pool.query(`${SELECT} WHERE e.id = $1`, [rows[0].id]);
  res.json(full[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rows: before } = await pool.query("SELECT * FROM exercises WHERE id = $1", [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Exercise not found." });

  try {
    await pool.query("DELETE FROM exercises WHERE id = $1", [req.params.id]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This exercise is used by a plan or a logged session — deactivate it instead." });
    }
    throw err;
  }

  await destroyAsset(before[0].media_public_id, before[0].media_type ?? "image");
  res.status(204).end();
}));

module.exports = router;
