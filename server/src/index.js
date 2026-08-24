require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { requireAuth, bootstrapAdmin } = require("./auth");
const { requireModule } = require("./moduleAccess");

const auth = require("./routes/auth");
const modules = require("./routes/modules");
const users = require("./routes/users");
const categories = require("./routes/categories");
const transactions = require("./routes/transactions");
const fixedExpenses = require("./routes/fixedExpenses");
const budgets = require("./routes/budgets");
const goals = require("./routes/goals");
const summary = require("./routes/summary");
const exercises = require("./routes/exercises");
const workouts = require("./routes/workouts");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Login lives outside the auth wall; everything below it needs a valid token.
app.use("/api/auth", auth);
app.use("/api", requireAuth);
app.use("/api/modules", modules);
app.use("/api/users", users);

// Each module's endpoints are gated on its access grant, so switching a module
// off for someone on the Users page actually blocks the data — it doesn't just
// hide the card.
const transactionsModule = requireModule("transactions");
app.use("/api/categories", transactionsModule, categories);
app.use("/api/transactions", transactionsModule, transactions);
app.use("/api/fixed-expenses", transactionsModule, fixedExpenses);
app.use("/api/budgets", transactionsModule, budgets);
app.use("/api/goals", transactionsModule, goals);
app.use("/api/summary", transactionsModule, summary);

const workoutModule = requireModule("workout");
app.use("/api/exercises", workoutModule, exercises);
app.use("/api/workouts", workoutModule, workouts);

// Web dashboard: the built React app (Vite outputs here). The client holds a
// JWT from /api/auth/login.
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// An unmatched /api path is a genuine 404 — answer in JSON rather than handing
// back the SPA's HTML, which would confuse any client parsing the response.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Everything else is a client-side route, so serve the app shell and let the
// router decide — otherwise refreshing /workout/sessions/3 would 404.
app.get(/.*/, (req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 4000;
app.listen(port, async () => {
  console.log(`Khata API listening on :${port}`);
  if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET is not set — nobody will be able to sign in until it is.");
  }
  try {
    await bootstrapAdmin();
  } catch (err) {
    console.error("Admin bootstrap failed:", err.message);
  }
});

// Last line of defense: without this, an uncaught rejection anywhere
// (a route someone forgot to wrap, a library callback, etc.) crashes the
// whole process — on a single free-tier instance that means every request
// fails until Render restarts it. Log and keep serving instead.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
