const pool = require("./db");
(async () => {
  await pool.query("INSERT INTO visits (id, count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING");
  console.log("seed: ligne initiale OK");
  await pool.end();
})().catch((e) => { console.error("seed failed:", e.message); process.exit(1); });
