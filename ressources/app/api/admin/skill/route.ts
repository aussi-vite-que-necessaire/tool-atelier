import { promises as fs } from "fs"
import path from "path"
import { headers } from "next/headers"
import JSZip from "jszip"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SKILL = "creer-une-ressource"

async function addDir(zip: JSZip, absDir: string, zipDir: string) {
  for (const entry of await fs.readdir(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name)
    const inZip = `${zipDir}/${entry.name}`
    if (entry.isDirectory()) await addDir(zip, abs, inZip)
    else zip.file(inZip, await fs.readFile(abs))
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return new Response("Forbidden", { status: 403 })
  }

  const skillDir = path.join(process.cwd(), "skills", SKILL)
  const zip = new JSZip()
  await addDir(zip, skillDir, SKILL)
  const body = await zip.generateAsync({ type: "arraybuffer" })

  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${SKILL}.zip"`,
      "cache-control": "no-store",
    },
  })
}
