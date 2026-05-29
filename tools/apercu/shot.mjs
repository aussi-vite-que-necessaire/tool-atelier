#!/usr/bin/env node
// shot.mjs — capture d'écran headless d'une page en cours de dev, via Playwright (chromium).
// L'œil de l'agent : il rend la page qu'il code, screenshote, puis Read le PNG pour SE VOIR et
// critiquer son rendu avant de pousser. Appelé par bin/apercu (qui installe Playwright +
// Chromium paresseusement). 100 % local au conteneur — aucune dépendance à la prod.
//
// Usage : node shot.mjs [url] [options]
//   url                 origine à viser (défaut http://localhost:3000)
//   --route <path>      chemin à ouvrir (défaut /), répétable pour plusieurs pages
//   --viewport <v>      preset `mobile` (390x844) | `desktop` (1440x900) | `WxH`, répétable
//                       (défaut : mobile + desktop)
//   --out <dir>         dossier de sortie (défaut /tmp/apercu/<timestamp>)
//   --full / --no-full  capture pleine page (défaut : pleine page)
//   --wait <selector>   attend ce sélecteur avant de capturer
//   --wait-ms <n>       attente fixe supplémentaire en ms (défaut 300)
//   --dry-run           résout et imprime le plan en JSON, sans lancer le navigateur
//
// Sortie : un chemin PNG absolu par ligne (préfixe « 📸 »), puis un récap. Code ≠ 0 si le
// serveur de dev est injoignable ou si une capture échoue.

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const PRESETS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

function parseArgs(argv) {
  const opts = {
    url: "http://localhost:3000",
    routes: [],
    viewports: [],
    out: null,
    full: true,
    wait: null,
    waitMs: 300,
    dryRun: false,
  };
  let urlSeen = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--route": opts.routes.push(argv[++i]); break;
      case "--viewport": opts.viewports.push(argv[++i]); break;
      case "--out": opts.out = argv[++i]; break;
      case "--full": opts.full = true; break;
      case "--no-full": opts.full = false; break;
      case "--wait": opts.wait = argv[++i]; break;
      case "--wait-ms": opts.waitMs = Number(argv[++i]); break;
      case "--dry-run": opts.dryRun = true; break;
      default:
        if (a.startsWith("--")) { throw new Error(`option inconnue : ${a}`); }
        if (!urlSeen) { opts.url = a; urlSeen = true; }
        else { throw new Error(`argument positionnel en trop : ${a}`); }
    }
  }
  if (opts.routes.length === 0) opts.routes = ["/"];
  if (opts.viewports.length === 0) opts.viewports = ["mobile", "desktop"];
  if (!opts.out) opts.out = `/tmp/apercu/${Date.now()}`;
  return opts;
}

function resolveViewport(v) {
  if (PRESETS[v]) return { name: v, ...PRESETS[v] };
  const m = /^(\d+)x(\d+)$/.exec(v);
  if (!m) throw new Error(`viewport invalide : ${v} (attendu : mobile | desktop | LARGExHAUT)`);
  return { name: v, width: Number(m[1]), height: Number(m[2]), deviceScaleFactor: 1 };
}

// Slug lisible pour le nom de fichier : "/" → home, "/a/b" → a-b.
function routeSlug(route) {
  const s = route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
  return s || "home";
}

function buildPlan(opts) {
  const base = opts.url.replace(/\/+$/, "");
  const viewports = opts.viewports.map(resolveViewport);
  const out = resolve(opts.out);
  const shots = [];
  for (const route of opts.routes) {
    const r = route.startsWith("/") ? route : `/${route}`;
    for (const vp of viewports) {
      shots.push({
        url: `${base}${r}`,
        route: r,
        viewport: vp,
        path: join(out, `${routeSlug(r)}-${vp.name}.png`),
      });
    }
  }
  return { url: base, out, fullPage: opts.full, wait: opts.wait, waitMs: opts.waitMs, shots };
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const plan = buildPlan(opts);

  if (opts.dryRun) {
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return;
  }

  mkdirSync(plan.out, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const written = [];
  try {
    for (const shot of plan.shots) {
      const context = await browser.newContext({
        viewport: { width: shot.viewport.width, height: shot.viewport.height },
        deviceScaleFactor: shot.viewport.deviceScaleFactor,
      });
      const page = await context.newPage();
      try {
        await page.goto(shot.url, { waitUntil: "networkidle", timeout: 20000 });
      } catch (err) {
        await context.close();
        throw new Error(
          `serveur de dev injoignable sur ${shot.url} — lance « npm run dev » dans le projet ` +
          `(et vérifie le port). Détail : ${err.message}`,
        );
      }
      if (plan.wait) await page.waitForSelector(plan.wait, { timeout: 10000 });
      if (plan.waitMs) await page.waitForTimeout(plan.waitMs);
      await page.screenshot({ path: shot.path, fullPage: plan.fullPage });
      written.push(shot.path);
      process.stdout.write(`📸 ${shot.path}  (${shot.route} · ${shot.viewport.name})\n`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`\n✓ ${written.length} capture(s) dans ${plan.out}\n`);
  process.stdout.write("→ Read chaque PNG pour le VOIR, puis critique (cf. skill /apercu).\n");
}

run().catch((err) => {
  process.stderr.write(`apercu: ${err.message}\n`);
  process.exit(1);
});
