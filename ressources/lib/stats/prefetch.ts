type HeaderGetter = { get(name: string): string | null }

export function isPrefetchRequest(headers: HeaderGetter): boolean {
  if (headers.get("next-router-prefetch") === "1") return true
  if ((headers.get("sec-purpose") ?? "").includes("prefetch")) return true
  if (headers.get("purpose") === "prefetch") return true
  return false
}
