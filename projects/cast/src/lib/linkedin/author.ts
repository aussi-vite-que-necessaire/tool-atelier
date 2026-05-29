export type LinkedInAuthor = { name: string; headline?: string; avatarUrl?: string };

type ResolveInput = {
  displayName?: string | null;
  userName?: string | null;
};

function clean(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

// Pur : reconstitue l'identité affichée à partir du compte connecté.
export function resolveAuthor(input: ResolveInput): LinkedInAuthor {
  const name = clean(input.displayName) ?? clean(input.userName) ?? 'Vous';
  return { name };
}
