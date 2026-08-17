const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM goals ORDER BY target_date NULLS LAST, id"
  );
  res.json(rows);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, target_amount, saved_amount = 0, target_date = null } = req.body;
  if (!name || target_amount === undefined) {
    return res.status(400).json({ error: "name and target_amount are required." });
  }
  const { rows } = await pool.query(
    `INSERT INTO goals (name, target_amount, saved_amount, target_date)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, target_amount, saved_amount, target_date]
  );
  res.status(201).json(rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, target_amount, saved_amount, target_date } = req.body;
  const { rows } = await pool.query(
    `UPDATE goals SET
       name = COALESCE($1, name),
       target_amount = COALESCE($2, target_amount),
       saved_amount = COALESCE($3, saved_amount),
       target_date = COALESCE($4, target_date)
     WHERE id = $5 RETURNING *`,
    [name, target_amount, saved_amount, target_date, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Goal not found." });
  res.json(rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM goals WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Goal not found." });
  res.status(204).end();
}));

module.exports = router;
