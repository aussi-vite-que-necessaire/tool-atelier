import { requireUserId } from '@/lib/auth/session';
import { skillArchive } from '@/lib/skills/archive';
import { getSkill } from '@/lib/skills/catalog';

export const dynamic = 'force-dynamic';

// Télécharge un skill en archive ZIP. Gardé par la session de la suite
// (requireUserId redirige vers /signin hors session). L'archive est construite
// en mémoire à partir du catalogue embarqué.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ name: string }> },
): Promise<Response> {
  await requireUserId();
  const { name } = await ctx.params;

  const manifest = await getSkill(name);
  if (!manifest) return new Response('Skill introuvable.', { status: 404 });

  const zip = await skillArchive(name);
  if (!zip) return new Response('Skill introuvable.', { status: 404 });

  return new Response(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}-v${manifest.version}.zip"`,
      'cache-control': 'no-store',
    },
  });
}
