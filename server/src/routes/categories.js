const express = require("express");
const { pool } = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, type, color, sort_order FROM categories ORDER BY sort_order, name"
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, type, color, sort_order = 0 } = req.body;
  if (!name || !type || !color) {
    return res.status(400).json({ error: "name, type, and color are required." });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO categories (name, type, color, sort_order) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, type, color, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A category with that name already exists." });
    throw err;
  }
});

router.put("/:id", async (req, res) => {
  const { name, type, color, sort_order } = req.body;
  const { rows } = await pool.query(
    `UPDATE categories SET
       name = COALESCE($1, name),
       type = COALESCE($2, type),
       color = COALESCE($3, color),
       sort_order = COALESCE($4, sort_order)
     WHERE id = $5 RETURNING *`,
    [name, type, color, sort_order, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Category not found." });
  res.json(rows[0]);
});

router.delete("/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Category not found." });
    res.status(204).end();
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This category is used by existing transactions or fixed bills." });
    }
    throw err;
  }
});

module.exports = router;
