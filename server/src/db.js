const { Pool, types } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// A DATE column is a calendar date, not an instant. Left alone, node-postgres
// turns it into a JS Date at the *server's* local midnight, which JSON then
// serialises as UTC — so 2026-08-20 reaches the client as
// "2026-08-19T19:00:00.000Z" and renders as the 19th. Hand back the raw
// "YYYY-MM-DD" instead and the date survives the trip unchanged.
// 1082 = DATE. TIMESTAMPTZ is left alone: those really are instants.
types.setTypeParser(types.builtins.DATE, (value) => value);

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = { pool };
