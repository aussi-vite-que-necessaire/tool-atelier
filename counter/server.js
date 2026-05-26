const http = require("http");
const pool = require("./db");
const env = process.env.APP_ENV || "dev";

const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") { res.writeHead(200); res.end("ok\n"); return; }
  try {
    const r = await pool.query(
      "INSERT INTO visits (id, count) VALUES (1, 1) ON CONFLICT (id) DO UPDATE SET count = visits.count + 1 RETURNING count"
    );
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`counter @ ${env}: ${r.rows[0].count}\n`);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`db error: ${e.message}\n`);
  }
});
server.listen(8080, () => console.log(`counter: listening on 8080 (env=${env})`));

// redeploy 2b
