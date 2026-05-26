const http = require("http");
const env = process.env.APP_ENV || "dev";

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") { res.writeHead(200); res.end("ok\n"); return; }
  if (req.url === "/" || req.url === "/api") return json(res, 200, { service: "api", env, message: "hello from the api starter" });
  json(res, 404, { error: "not found" });
});
server.listen(8080, () => console.log(`api: listening on 8080 (env=${env})`));
