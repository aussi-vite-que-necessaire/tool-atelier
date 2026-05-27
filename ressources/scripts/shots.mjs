// Harnais de captures d'écran (session de refonte UI).
// Usage :
//   DEV_LOG=<chemin log dev> node scripts/shots.mjs login
//   node scripts/shots.mjs shoot <label>
// `login` se connecte en OTP (code lu dans le log du serveur dev) et sauve l'état.
// `shoot` recharge l'état et capture l'ensemble des écrans dans /tmp/lab-shots/<label>.
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const EMAIL = process.env.SHOT_EMAIL || "demo@avqn.ch"
const STATE = "/tmp/lab-shots/state.json"
const DEV_LOG = process.env.DEV_LOG || ""

const ROUTES = [
  { name: "01-accueil", url: "/", full: true },
  { name: "02-connexion", url: "/connexion", full: false },
  { name: "03-gate", url: "/r/atelier-prive", full: true },
  { name: "04-reader-intro", url: "/r/showcase", full: true },
  { name: "05-reader-modules-a", url: "/r/showcase/blocs-texte", full: true },
  { name: "06-reader-modules-b", url: "/r/showcase/blocs-media", full: true },
  { name: "07-reader-modules-c", url: "/r/showcase/blocs-riches", full: true },
  { name: "08-bibliotheque", url: "/bibliotheque", full: true },
  { name: "08b-compte", url: "/compte", full: true },
  { name: "09-admin-dashboard", url: "/admin", full: true },
  { name: "10-admin-ressource", url: "/admin/r/showcase", full: true },
  { name: "11-admin-page", url: "/admin/r/showcase/p/", full: true },
  // Permutations de mise en page du reader (rails gauche/droite)
  { name: "12-layout-2-rails", url: "/r/showcase", full: true },
  { name: "13-layout-gauche", url: "/r/guide-ia/pour-aller-plus-loin", full: true },
  { name: "14-layout-droite", url: "/r/automatiser-n8n", full: true },
  { name: "15-layout-aucun", url: "/r/manifeste", full: true },
]
const MOBILE = ["01-accueil", "04-reader-intro", "07-reader-modules-c", "15-layout-aucun"]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function readOtp(minCount) {
  // Attend qu'un nouveau code [OTP] <email> -> <code> apparaisse, puis renvoie le plus récent.
  for (let i = 0; i < 40; i++) {
    if (DEV_LOG && fs.existsSync(DEV_LOG)) {
      const txt = fs.readFileSync(DEV_LOG, "utf8")
      const matches = [...txt.matchAll(/\[OTP\]\s+(\S+)\s+->\s+(\d{6})/g)].filter((m) => m[1] === EMAIL)
      if (matches.length > minCount) return matches[matches.length - 1][2]
    }
    await sleep(500)
  }
  throw new Error("OTP introuvable dans le log dev (DEV_LOG=" + DEV_LOG + ")")
}

async function login() {
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const prior = DEV_LOG && fs.existsSync(DEV_LOG)
    ? [...fs.readFileSync(DEV_LOG, "utf8").matchAll(/\[OTP\]\s+(\S+)\s+->\s+(\d{6})/g)].filter((m) => m[1] === EMAIL).length
    : 0
  const send = await ctx.request.post(`${BASE}/api/auth/email-otp/send-verification-otp`, {
    data: { email: EMAIL, type: "sign-in" },
  })
  if (!send.ok()) throw new Error("send-verification-otp: " + send.status() + " " + (await send.text()))
  const otp = await readOtp(prior)
  const verify = await ctx.request.post(`${BASE}/api/auth/sign-in/email-otp`, {
    data: { email: EMAIL, otp },
  })
  if (!verify.ok()) throw new Error("sign-in/email-otp: " + verify.status() + " " + (await verify.text()))
  await ctx.storageState({ path: STATE })
  await browser.close()
  console.log("login OK ->", EMAIL, "(état:", STATE + ")")
}

async function shoot(label) {
  const outDir = path.join("/tmp/lab-shots", label)
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    storageState: fs.existsSync(STATE) ? STATE : undefined,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  await ctx.addInitScript(() => {
    const s = document.createElement("style")
    s.textContent = "nextjs-portal,[data-next-badge-root],[data-nextjs-toast]{display:none!important}"
    document.documentElement.appendChild(s)
  })
  const page = await ctx.newPage()
  for (const r of ROUTES) {
    try {
      await page.goto(`${BASE}${r.url}`, { waitUntil: "networkidle", timeout: 20000 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(outDir, `${r.name}.png`), fullPage: r.full })
      console.log("✓", r.name, r.url)
    } catch (e) {
      console.log("✗", r.name, r.url, "-", e.message)
    }
  }
  await ctx.close()
  // Pass mobile (390px)
  const mctx = await browser.newContext({
    storageState: fs.existsSync(STATE) ? STATE : undefined,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await mctx.addInitScript(() => {
    const s = document.createElement("style")
    s.textContent = "nextjs-portal,[data-next-badge-root],[data-nextjs-toast]{display:none!important}"
    document.documentElement.appendChild(s)
  })
  const mpage = await mctx.newPage()
  for (const r of ROUTES.filter((x) => MOBILE.includes(x.name))) {
    try {
      await mpage.goto(`${BASE}${r.url}`, { waitUntil: "networkidle", timeout: 20000 })
      await mpage.waitForTimeout(500)
      await mpage.screenshot({ path: path.join(outDir, `${r.name}-mobile.png`), fullPage: r.full })
      console.log("✓", r.name, "(mobile)")
    } catch (e) {
      console.log("✗", r.name, "(mobile) -", e.message)
    }
  }
  await mctx.close()
  await browser.close()
  console.log("captures ->", outDir)
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === "login") await login()
else if (cmd === "shoot") await shoot(arg || "shots")
else {
  console.log("commande: login | shoot <label>")
  process.exit(1)
}
