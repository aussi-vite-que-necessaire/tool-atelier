// Récupère les octets d'un média depuis son URL publique (pour la publication).
export async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch média ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}
