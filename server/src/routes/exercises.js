const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");
const { uniqueSlug } = require("../slugify");
const { destroyAsset, isConfigured, signUpload } = require("../cloudinary");

const router = express.Router();

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
  const { active, q } = req.query;
  const clauses = [];
  const params = [];
  if (active === "true" || active === "false") {
    params.push(active === "true");
    clauses.push(`active = $${params.length}`);
  }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim()}%`);
    clauses.push(
      `(name ILIKE $${params.length} OR muscle_group ILIKE $${params.length} OR equipment ILIKE $${params.length})`
    );
  }
  const { rows } = await pool.query(
    `SELECT * FROM exercises ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY sort_order, name`,
    params
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const {
    name,
    muscle_group = "",
    equipment = "",
    notes = "",
    active = true,
    media_url = null,
    media_public_id = null,
    media_type = null,
  } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "Exercise name is required." });

  try {
    const { rows: last } = await pool.query("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM exercises");
    const { rows } = await pool.query(
      `INSERT INTO exercises (name, slug, muscle_group, equipment, notes, sort_order, active,
                              media_url, media_public_id, media_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        String(name).trim(),
        await uniqueSlug("exercises", name),
        muscle_group,
        equipment,
        notes,
        last[0].next,
        active,
        media_url,
        media_public_id,
        media_type,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "An exercise with that name already exists." });
    throw err;
  }
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, muscle_group, equipment, notes, sort_order, active, media_url, media_public_id, media_type } =
    req.body;

  const { rows: before } = await pool.query("SELECT * FROM exercises WHERE id = $1", [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Exercise not found." });

  // Media is only touched when the caller actually sends a media field, so an
  // ordinary edit (renaming, toggling active) can't wipe an attached clip.
  const touchingMedia = "media_url" in req.body || "media_public_id" in req.body;
  const slug = name ? await uniqueSlug("exercises", name, req.params.id) : null;

  const { rows } = await pool.query(
    `UPDATE exercises SET
       name = COALESCE($1, name),
       slug = COALESCE($2, slug),
       muscle_group = COALESCE($3, muscle_group),
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
      muscle_group,
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
  );

  // Replacing or clearing media leaves the old file stranded on Cloudinary.
  const oldId = before[0].media_public_id;
  if (touchingMedia && oldId && oldId !== rows[0].media_public_id) {
    await destroyAsset(oldId, before[0].media_type ?? "image");
  }

  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rows: before } = await pool.query("SELECT * FROM exercises WHERE id = $1", [req.params.id]);
  if (!before[0]) return res.status(404).json({ error: "Exercise not found." });

  try {
    await pool.query("DELETE FROM exercises WHERE id = $1", [req.params.id]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This exercise is used by logged sets — deactivate it instead." });
    }
    throw err;
  }

  await destroyAsset(before[0].media_public_id, before[0].media_type ?? "image");
  res.status(204).end();
}));

module.exports = router;
