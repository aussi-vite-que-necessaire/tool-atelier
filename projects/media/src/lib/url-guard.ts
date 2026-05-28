// Garde anti-SSRF pour le rendu de HTML arbitraire : bloque les requêtes sortantes
// vers des cibles internes ou des schémas non-réseau. Défense en profondeur — ne
// couvre PAS le DNS rebinding (un hostname public résolvant vers une IP privée).
// Politique fail-open : on n'autorise le blocage que sur des cas clairement mauvais,
// pour ne pas casser le chargement légitime de polices/CSS/images depuis des CDN publics.

export function isBlockedUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false; // about:blank, blob:..., URLs internes du navigateur → laisser passer
  }
  const scheme = url.protocol.toLowerCase();
  // Pas d'egress réseau : inoffensif pour le SSRF.
  if (scheme === "data:" || scheme === "blob:" || scheme === "about:") return false;
  // Seuls http/https sont autorisés ; file:, ftp:, etc. sont bloqués.
  if (scheme !== "http:" && scheme !== "https:") return true;
  return isPrivateHost(url.hostname);
}

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;

  // IPv6 loopback / ULA (fc00::/7) / link-local (fe80::/10)
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;

  // IPv4 littéral
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127) return true; // this-network, loopback
    if (a === 10) return true; // privé
    if (a === 169 && b === 254) return true; // link-local (métadonnées cloud)
    if (a === 172 && b >= 16 && b <= 31) return true; // privé
    if (a === 192 && b === 168) return true; // privé
  }

  return false;
}
