import { promises as fs } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { getSkill, getSkillDir } from "@/lib/skills-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function addDirToZip(zip: JSZip, absDir: string, zipDir: string) {
  for (const entry of await fs.readdir(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const inZip = `${zipDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await addDirToZip(zip, abs, inZip);
    } else {
      zip.file(inZip, await fs.readFile(abs));
    }
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Connecte-toi pour télécharger.", { status: 401 });

  const { name } = await params;
  const manifest = await getSkill(name);
  if (!manifest) return new Response("Skill introuvable.", { status: 404 });

  const skillDir = getSkillDir(name);
  const zip = new JSZip();
  await addDirToZip(zip, skillDir, name);
  const body = await zip.generateAsync({ type: "arraybuffer" });

  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}-v${manifest.version}.zip"`,
      "cache-control": "no-store",
    },
  });
}
