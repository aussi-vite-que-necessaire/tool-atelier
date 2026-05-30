export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canAccess(
  resource: { published: boolean; visibility: string },
  email: string | null,
  grantedEmails: string[],
): boolean {
  if (!resource.published) return false;
  if (!email) return false;
  if (resource.visibility === 'public') return true;
  if (resource.visibility === 'private') {
    return grantedEmails.map(normalizeEmail).includes(normalizeEmail(email));
  }
  return false;
}
