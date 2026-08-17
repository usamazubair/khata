require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { requireApiKey } = require("./middleware/auth");

const categories = require("./routes/categories");
const transactions = require("./routes/transactions");
const fixedExpenses = require("./routes/fixedExpenses");
const budgets = require("./routes/budgets");
const goals = require("./routes/goals");
const summary = require("./routes/summary");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", requireApiKey);
app.use("/api/categories", categories);
app.use("/api/transactions", transactions);
app.use("/api/fixed-expenses", fixedExpenses);
app.use("/api/budgets", budgets);
app.use("/api/goals", goals);
app.use("/api/summary", summary);

// Read-only web dashboard (static files, password-gated client-side against API_KEY).
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Khata API listening on :${port}`));
