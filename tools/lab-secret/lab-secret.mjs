#!/usr/bin/env node
// lab-secret — gestionnaire de secrets de l'atelier.
//
// Les secrets vivent dans des fichiers `.env` chiffrés avec age (armure ASCII)
// versionnés dans le repo. Une seule clé privée age (LAB_SECRETS_KEY) chiffre et
// déchiffre tout. Le déchiffrement se fait en mémoire : aucun clair n'atterrit sur
// disque. Implémentation age en pur JS (age-encryption) → tourne partout où il y a
// node, sans binaire système.
//
// Usage :
//   lab-secret set  <scope> <NAME>   (valeur lue sur stdin — jamais en argument)
//   lab-secret get  <scope> <NAME>   (imprime UNIQUEMENT la valeur)
//   lab-secret list [scope]          (liste les NOMS, jamais les valeurs)
//   lab-secret rm   <scope> <NAME>
//
// scope ∈ global | sysadmin | <projet>

import { Encrypter, Decrypter, identityToRecipient, armor } from "age-encryption";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Racine du repo = deux niveaux au-dessus de tools/lab-secret/
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const SECRETS_DIR = join(REPO_ROOT, "secrets");
const PROJECTS_DIR = join(SECRETS_DIR, "projects");
const RECIPIENTS_FILE = join(SECRETS_DIR, "recipients.txt");

function die(msg) {
  process.stderr.write(`lab-secret: ${msg}\n`);
  process.exit(1);
}

function getIdentity() {
  const key = process.env.LAB_SECRETS_KEY;
  if (!key || !key.trim()) {
    die("LAB_SECRETS_KEY absente de l'environnement (identité age AGE-SECRET-KEY-1…)");
  }
  const id = key.trim();
  if (!id.startsWith("AGE-SECRET-KEY-1")) {
    die("LAB_SECRETS_KEY ne ressemble pas à une identité age (AGE-SECRET-KEY-1…)");
  }
  return id;
}

// Destinataire (clé publique) : dérivée de l'identité ; recipients.txt sert de repli/contrôle.
async function getRecipient(identity) {
  const derived = await identityToRecipient(identity);
  if (existsSync(RECIPIENTS_FILE)) {
    const fileRecipients = readFileSync(RECIPIENTS_FILE, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    if (fileRecipients.length && !fileRecipients.includes(derived)) {
      die(
        "la clé publique dérivée de LAB_SECRETS_KEY ne figure pas dans secrets/recipients.txt — clé incohérente avec le store",
      );
    }
  }
  return derived;
}

// scope → chemin du fichier .age
function scopeFile(scope) {
  if (scope === "global") return join(SECRETS_DIR, "global.env.age");
  if (scope === "sysadmin") return join(SECRETS_DIR, "sysadmin.env.age");
  if (!/^[A-Za-z0-9._-]+$/.test(scope)) die(`scope invalide : ${scope}`);
  return join(PROJECTS_DIR, `${scope}.env.age`);
}

function validName(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    die(`NAME invalide : « ${name} » (doit être un identifiant d'env shell : [A-Za-z_][A-Za-z0-9_]*)`);
  }
}

// Déchiffre un fichier de scope en mémoire → texte clair (vide si absent/vide).
async function decryptScope(identity, file) {
  if (!existsSync(file)) return "";
  const raw = readFileSync(file, "utf8");
  if (!raw.trim()) return "";
  const d = new Decrypter();
  d.addIdentity(identity);
  try {
    return await d.decrypt(armor.decode(raw), "text");
  } catch (err) {
    die(`déchiffrement impossible de ${file} (clé incompatible ?) : ${err.message}`);
  }
}

// Chiffre un texte clair (armure ASCII) → string à écrire sur disque.
async function encryptScope(recipient, plaintext) {
  const e = new Encrypter();
  e.addRecipient(recipient);
  const ct = await e.encrypt(plaintext);
  return armor.encode(ct);
}

// Parse un .env (KEY=VALUE par ligne) en liste ordonnée de {key, value, raw}.
function parseEnv(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const eq = line.indexOf("=");
    if (eq <= 0) {
      // ligne non KEY=VALUE (commentaire, etc.) : on la conserve telle quelle
      entries.push({ key: null, value: null, raw: line });
      continue;
    }
    entries.push({ key: line.slice(0, eq), value: line.slice(eq + 1), raw: line });
  }
  return entries;
}

function serializeEnv(entries) {
  const text = entries.map((e) => (e.key === null ? e.raw : `${e.key}=${e.value}`)).join("\n");
  return text.length ? text + "\n" : "";
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function gitCommit(file, message) {
  const opts = { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "pipe"] };
  try {
    execFileSync("git", ["add", "--", file], opts);
    // Rien de stagé (valeur identique) → pas de commit, mais pas d'erreur non plus.
    const diff = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: REPO_ROOT });
    if (!diff.toString().trim()) {
      process.stderr.write("lab-secret: aucun changement à committer.\n");
      return;
    }
    execFileSync("git", ["commit", "-m", message], opts);
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    die(`commit git échoué : ${stderr.trim()}`);
  }
}

async function cmdSet(scope, name) {
  validName(name);
  const identity = getIdentity();
  const recipient = await getRecipient(identity);
  const value = readStdin().replace(/\n$/, ""); // strip un seul \n final (terminal/echo)
  const file = scopeFile(scope);

  const current = await decryptScope(identity, file);
  const entries = parseEnv(current);
  const existing = entries.find((e) => e.key === name);
  if (existing) {
    existing.value = value;
  } else {
    entries.push({ key: name, value, raw: null });
  }

  const out = await encryptScope(recipient, serializeEnv(entries));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out);
  gitCommit(file, `🔐 secret: set ${scope}/${name}`);
  process.stderr.write(`lab-secret: ${scope}/${name} chiffré et committé.\n`);
}

async function cmdGet(scope, name) {
  validName(name);
  const identity = getIdentity();
  const file = scopeFile(scope);
  const current = await decryptScope(identity, file);
  const entry = parseEnv(current).find((e) => e.key === name);
  if (!entry) process.exit(1);
  process.stdout.write(entry.value);
}

function allScopes() {
  const scopes = [];
  if (existsSync(join(SECRETS_DIR, "global.env.age"))) scopes.push("global");
  if (existsSync(join(SECRETS_DIR, "sysadmin.env.age"))) scopes.push("sysadmin");
  if (existsSync(PROJECTS_DIR)) {
    for (const f of readdirSync(PROJECTS_DIR).sort()) {
      if (f.endsWith(".env.age")) scopes.push(f.slice(0, -".env.age".length));
    }
  }
  return scopes;
}

async function cmdList(scope) {
  const identity = getIdentity();
  const scopes = scope ? [scope] : allScopes();
  for (const s of scopes) {
    const current = await decryptScope(identity, scopeFile(s));
    const names = parseEnv(current)
      .filter((e) => e.key !== null)
      .map((e) => e.key);
    if (scope) {
      for (const n of names) process.stdout.write(`${n}\n`);
    } else {
      process.stdout.write(`[${s}]\n`);
      for (const n of names) process.stdout.write(`  ${n}\n`);
    }
  }
}

async function cmdRm(scope, name) {
  validName(name);
  const identity = getIdentity();
  const recipient = await getRecipient(identity);
  const file = scopeFile(scope);
  const current = await decryptScope(identity, file);
  const entries = parseEnv(current);
  const next = entries.filter((e) => e.key !== name);
  if (next.length === entries.length) die(`${scope}/${name} introuvable.`);
  const out = await encryptScope(recipient, serializeEnv(next));
  writeFileSync(file, out);
  gitCommit(file, `🔐 secret: rm ${scope}/${name}`);
  process.stderr.write(`lab-secret: ${scope}/${name} supprimé et committé.\n`);
}

function usage() {
  process.stderr.write(
    [
      "Usage :",
      "  lab-secret set  <scope> <NAME>   (valeur sur stdin)",
      "  lab-secret get  <scope> <NAME>",
      "  lab-secret list [scope]",
      "  lab-secret rm   <scope> <NAME>",
      "",
      "scope ∈ global | sysadmin | <projet>",
      "LAB_SECRETS_KEY (identité age) doit être dans l'environnement.",
      "",
    ].join("\n"),
  );
}

async function main() {
  const [cmd, scope, name] = process.argv.slice(2);
  switch (cmd) {
    case "set":
      if (!scope || !name) { usage(); process.exit(2); }
      return cmdSet(scope, name);
    case "get":
      if (!scope || !name) { usage(); process.exit(2); }
      return cmdGet(scope, name);
    case "list":
      return cmdList(scope);
    case "rm":
      if (!scope || !name) { usage(); process.exit(2); }
      return cmdRm(scope, name);
    default:
      usage();
      process.exit(2);
  }
}

main().catch((err) => die(err.stack || err.message));
