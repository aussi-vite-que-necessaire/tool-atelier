#!/usr/bin/env node
// Compose un projet de l'atelier depuis starters/base + starters/modules/<nom>.
// Déterministe : fusionne package.json, lab.json, .env.example, génère le barrel
// Drizzle + l'instance/le client auth, copie les fichiers de chaque module.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const STARTERS = path.join(ROOT, "starters");
const MODULE_ORDER = ["db", "email", "redis", "auth", "mcp"];

export async function loadManifest(name) {
  return JSON.parse(await fs.readFile(path.join(STARTERS, "modules", name, "module.json"), "utf8"));
}

// Résout la cascade : ajoute les pré-requis (mcp⇒auth+db, auth⇒db) et email auto
// si l'auth utilise OTP ou magic-link. Renvoie les modules en ordre topologique.
export async function resolveModules(selected, authMethods = []) {
  const set = new Set(selected);
  if (set.has("mcp")) {
    set.add("auth");
    set.add("db");
  }
  if (set.has("auth")) {
    set.add("db");
    if (authMethods.includes("otp") || authMethods.includes("magic-link")) set.add("email");
  }
  return MODULE_ORDER.filter((m) => set.has(m));
}

async function writeJson(p, obj) {
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n");
}

function fill(s, name, description) {
  return s.replaceAll("__PROJECT_NAME__", name).replaceAll("__DESCRIPTION__", description);
}

export async function compose({ name, description, modules = [], authMethods = [], mcp = null, outDir }) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`nom de projet invalide: ${name}`);
  const dst = outDir ?? path.join(ROOT, name);
  await fs.cp(path.join(STARTERS, "base"), dst, { recursive: true });

  const resolved = await resolveModules(modules, authMethods);
  const manifests = [];
  for (const m of resolved) manifests.push(await loadManifest(m));

  // package.json
  const pkgPath = path.join(dst, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkg.name = name;
  for (const man of manifests) {
    Object.assign((pkg.dependencies ??= {}), man.deps ?? {});
    Object.assign((pkg.devDependencies ??= {}), man.devDeps ?? {});
    Object.assign((pkg.scripts ??= {}), man.scripts ?? {});
  }
  await writeJson(pkgPath, pkg);

  // lab.json
  const labPath = path.join(dst, "lab.json");
  const lab = JSON.parse(fill(await fs.readFile(labPath, "utf8"), name, description));
  for (const man of manifests) Object.assign(lab, man.labJson ?? {});
  await writeJson(labPath, lab);

  // .env.example
  const envKeys = manifests.flatMap((m) => m.env ?? []);
  if (envKeys.length) {
    const cur = await fs.readFile(path.join(dst, ".env.example"), "utf8");
    await fs.writeFile(
      path.join(dst, ".env.example"),
      cur + "\n" + envKeys.map((e) => `${e}=`).join("\n") + "\n",
    );
  }

  // fichiers texte avec placeholders (page, layout, CLAUDE.md de la base)
  for (const rel of ["src/app/page.tsx", "src/app/layout.tsx", "CLAUDE.md"]) {
    const p = path.join(dst, rel);
    await fs.writeFile(p, fill(await fs.readFile(p, "utf8"), name, description));
  }

  // copie des fichiers de modules
  for (const man of manifests) {
    const modDir = path.join(STARTERS, "modules", man.name);
    for (const rel of man.files ?? []) {
      const to = path.join(dst, rel);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.cp(path.join(modDir, rel), to, { recursive: true });
    }
  }

  // barrel Drizzle (si db)
  if (resolved.includes("db")) {
    const frags = manifests.flatMap((m) => m.schemas ?? []);
    const body = frags.length
      ? frags.map((f) => `import { ${f.exports.join(", ")} } from "${f.import}";`).join("\n") +
        `\n\nexport const schema = { ${frags.flatMap((f) => f.exports).join(", ")} };\n`
      : `export const schema = {};\n`;
    await fs.writeFile(path.join(dst, "src/db/schema.ts"), body);
  }

  // auth générée (si auth)
  if (resolved.includes("auth")) {
    const hasMcp = resolved.includes("mcp");
    await fs.writeFile(path.join(dst, "src/lib/auth.ts"), renderAuthFile({ methods: authMethods, hasMcp }));
    await fs.writeFile(path.join(dst, "src/lib/auth-client.ts"), renderAuthClient({ methods: authMethods }));
    await fs.writeFile(
      path.join(dst, "src/lib/auth-methods.ts"),
      `export const AUTH_METHODS = ${JSON.stringify(authMethods)} as const;\n`,
    );
  }

  return { dir: dst, modules: resolved };
}

// Génère src/lib/auth.ts selon les méthodes choisies + présence du MCP.
export function renderAuthFile({ methods, hasMcp }) {
  const otp = methods.includes("otp");
  const magic = methods.includes("magic-link");
  const password = methods.includes("password");
  const pluginImports = [otp && "emailOTP", magic && "magicLink", hasMcp && "mcp"].filter(Boolean);
  const lines = [];
  lines.push(`import { betterAuth } from "better-auth";`);
  lines.push(`import { drizzleAdapter } from "better-auth/adapters/drizzle";`);
  if (pluginImports.length) lines.push(`import { ${pluginImports.join(", ")} } from "better-auth/plugins";`);
  lines.push(`import { db } from "@/db";`);
  lines.push(`import { schema } from "@/db/schema";`);
  if (otp || magic) lines.push(`import { sendEmail } from "@/lib/email";`);
  if (otp) lines.push(`import { isPreview, PREVIEW_OTP } from "@/lib/auth-preview";`);
  lines.push("");
  lines.push(`const baseURL = process.env.APP_URL ?? "http://localhost:3000";`);
  lines.push("");
  lines.push(`export const auth = betterAuth({`);
  lines.push(`  database: drizzleAdapter(db, { provider: "pg", schema }),`);
  lines.push(`  secret: process.env.BETTER_AUTH_SECRET,`);
  lines.push(`  baseURL,`);
  lines.push(`  trustedOrigins: [baseURL],`);
  if (password) lines.push(`  emailAndPassword: { enabled: true },`);
  const plugins = [];
  if (otp)
    plugins.push(
      `    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      ...(isPreview ? { generateOTP: () => PREVIEW_OTP } : {}),
      async sendVerificationOTP({ email, otp }) {
        if (isPreview) return;
        await sendEmail({
          to: email,
          subject: "Ton code de connexion",
          html: \`<p>Ton code : <b>\${otp}</b> (expire dans 10 minutes).</p>\`,
        });
      },
    })`,
    );
  if (magic)
    plugins.push(
      `    magicLink({
      async sendMagicLink({ email, url }) {
        await sendEmail({
          to: email,
          subject: "Ton lien de connexion",
          html: \`<p><a href="\${url}">Se connecter</a> (expire bientôt).</p>\`,
        });
      },
    })`,
    );
  if (hasMcp)
    plugins.push(
      `    mcp({
      loginPage: "/sign-in",
      oidcConfig: { loginPage: "/sign-in", allowDynamicClientRegistration: true, requirePKCE: true },
    })`,
    );
  if (plugins.length) {
    lines.push(`  plugins: [`);
    lines.push(plugins.join(",\n") + ",");
    lines.push(`  ],`);
  }
  lines.push(`});`);
  lines.push("");
  lines.push(`export type Session = typeof auth.$Infer.Session;`);
  return lines.join("\n") + "\n";
}

// Génère src/lib/auth-client.ts selon les méthodes choisies.
export function renderAuthClient({ methods }) {
  const otp = methods.includes("otp");
  const magic = methods.includes("magic-link");
  const clientPlugins = [otp && "emailOTPClient", magic && "magicLinkClient"].filter(Boolean);
  const lines = [`"use client";`, ""];
  if (clientPlugins.length) lines.push(`import { ${clientPlugins.join(", ")} } from "better-auth/client/plugins";`);
  lines.push(`import { createAuthClient } from "better-auth/react";`, "");
  const inst = clientPlugins.length ? `{ plugins: [${clientPlugins.map((p) => p + "()").join(", ")}] }` : "";
  lines.push(`export const authClient = createAuthClient(${inst});`, "");
  lines.push(`export const { signIn, signUp, signOut, useSession } = authClient;`);
  return lines.join("\n") + "\n";
}

// CLI : node scripts/compose-project.mjs '<json>'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: compose-project.mjs '<json-config>'");
    process.exit(1);
  }
  compose(JSON.parse(arg))
    .then((r) => console.log(`composé: ${r.dir} (modules: ${r.modules.join(", ") || "aucun"})`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
