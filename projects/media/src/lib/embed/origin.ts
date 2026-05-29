// Allowlist des origines autorisées à embarquer la page /embed de media dans une
// iframe (et à recevoir les postMessage). Pur, sans I/O → testable.
//
// Autorisé :
//  - https://cast.contentos.ch              (cast prod embarque media prod)
//  - https://<label>.preview.contentos.ch   (previews : cast-<branche>, etc.)
//  - http://localhost[:port] / 127.0.0.1    (dev local)
export function isAllowedParentOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  // N'accepter qu'une origine nue (scheme://host[:port]), pas une URL avec path.
  if (origin !== u.origin) return false;

  const { protocol, hostname } = u;
  if (protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return true;
  }
  if (protocol !== "https:") return false;
  if (hostname === "cast.contentos.ch") return true;
  // Un seul label avant .preview.contentos.ch (ex. cast-ma-branche).
  return /^[a-z0-9-]+\.preview\.contentos\.ch$/.test(hostname);
}
