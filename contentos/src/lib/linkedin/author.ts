export type LinkedInAuthor = { name: string; headline?: string; avatarUrl?: string };

type ResolveInput = {
  displayName?: string | null;
  brandName?: string | null;
  brandSignature?: string | null;
  brandLogoUrl?: string | null;
  userName?: string | null;
};

function clean(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

// Pur : reconstitue l'identité affichée à partir des sources disponibles.
export function resolveAuthor(input: ResolveInput): LinkedInAuthor {
  const name = clean(input.displayName) ?? clean(input.brandName) ?? clean(input.userName) ?? 'Vous';
  const author: LinkedInAuthor = { name };
  const headline = clean(input.brandSignature);
  if (headline) author.headline = headline;
  const avatarUrl = clean(input.brandLogoUrl);
  if (avatarUrl) author.avatarUrl = avatarUrl;
  return author;
}
