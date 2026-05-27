import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compose, resolveModules } from "../scripts/compose-project.mjs";

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), "compose-"));
}
const read = (d, f) => fs.readFile(path.join(d, f), "utf8");
const readJson = async (d, f) => JSON.parse(await read(d, f));

test("cascade : mcp tire auth + db ; otp tire email", async () => {
  assert.deepEqual(await resolveModules(["mcp"], ["otp"]), ["db", "email", "auth", "mcp"]);
  assert.deepEqual(await resolveModules(["auth"], ["password"]), ["db", "auth"]);
  assert.deepEqual(await resolveModules([], []), []);
});

test("frontend only : base copiée, lab.json sans capacité", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-front", description: "Démo", modules: [], outDir });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.description, "Démo");
  assert.equal(lab.db, undefined);
  const pkg = await readJson(outDir, "package.json");
  assert.equal(pkg.name, "demo-front");
  assert.ok(!pkg.dependencies["better-auth"]);
});

test("db + redis : flags lab.json + deps fusionnées", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-data", description: "x", modules: ["db", "redis"], outDir });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.db, true);
  assert.equal(lab.redis, true);
  const pkg = await readJson(outDir, "package.json");
  assert.ok(pkg.dependencies["drizzle-orm"]);
  assert.ok(pkg.dependencies["ioredis"]);
  const schema = await read(outDir, "src/db/schema.ts");
  assert.match(schema, /export const schema = \{\s*\}/); // db sans auth = schéma vide
});

test("full : auth 3 méthodes + mcp → auth.ts contient les bons plugins", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({
    name: "demo-full",
    description: "x",
    modules: ["db", "redis", "auth", "mcp"],
    authMethods: ["otp", "password", "magic-link"],
    mcp: { server: "demo", instructions: "Démo." },
    outDir,
  });
  const lab = await readJson(outDir, "lab.json");
  assert.equal(lab.email, true); // auto via otp/magic-link
  const auth = await read(outDir, "src/lib/auth.ts");
  assert.match(auth, /emailAndPassword:\s*\{\s*enabled:\s*true/);
  assert.match(auth, /emailOTP\(/);
  assert.match(auth, /magicLink\(/);
  assert.match(auth, /mcp\(/);
  const client = await read(outDir, "src/lib/auth-client.ts");
  assert.match(client, /emailOTPClient\(\)/);
  assert.match(client, /magicLinkClient\(\)/);
  const schema = await read(outDir, "src/db/schema.ts");
  assert.match(schema, /user, session, account, verification/);
  await fs.access(path.join(outDir, "src/app/api/mcp/route.ts"));
  await fs.access(path.join(outDir, "src/app/.well-known/oauth-protected-resource/route.ts"));
});

test("otp seul n'importe pas emailAndPassword ni magicLink", async () => {
  const outDir = path.join(await tmp(), "app");
  await compose({ name: "demo-otp", description: "x", modules: ["auth"], authMethods: ["otp"], outDir });
  const auth = await read(outDir, "src/lib/auth.ts");
  assert.doesNotMatch(auth, /emailAndPassword/);
  assert.doesNotMatch(auth, /magicLink\(/);
  assert.match(auth, /emailOTP\(/);
});
