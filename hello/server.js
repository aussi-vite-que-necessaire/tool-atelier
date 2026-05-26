const http = require("http");

const env = process.env.APP_ENV || "dev";
const port = 8080;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(`bonjour claude\n`);
});

server.listen(port, () => console.log(`hello: listening on ${port} (env=${env})`));
