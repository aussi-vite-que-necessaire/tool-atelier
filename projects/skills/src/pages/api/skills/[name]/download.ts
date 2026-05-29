import type { APIRoute } from "astro";
import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { getSession } from "@/lib/auth";
import { getSkill, getSkillDir } from "@/lib/skills-fs";

export const prerender = false;

async function addDirToZip(zip: JSZip, absDir: string, zipDir: string) {
  for (const entry of await fs.readdir(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    const inZip = `${zipDir}/${entry.name}`;
    if (entry.isDirectory()) await addDirToZip(zip, abs, inZip);
    else zip.file(inZip, await fs.readFile(abs));
  }
}

export const GET: APIRoute = async ({ request, params }) => {
  const session = await getSession(request.headers);
  if (!session) return new Response("Connecte-toi pour télécharger.", { status: 401 });

  const name = params.name;
  if (!name) return new Response("Skill manquant.", { status: 400 });

  const manifest = await getSkill(name);
  if (!manifest) return new Response("Skill introuvable.", { status: 404 });

  const zip = new JSZip();
  await addDirToZip(zip, getSkillDir(name), name);
  const body = await zip.generateAsync({ type: "arraybuffer" });

  return new Response(body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}-v${manifest.version}.zip"`,
      "cache-control": "no-store",
    },
  });
};
