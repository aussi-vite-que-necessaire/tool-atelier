const pool = require("./db");
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS visits (
    id integer PRIMARY KEY DEFAULT 1,
    count integer NOT NULL DEFAULT 0
  )`);
  console.log("migrate: table visits OK");
  await pool.end();
})().catch((e) => { console.error("migrate failed:", e.message); process.exit(1); });
