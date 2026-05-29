// Identités de test, preview uniquement (jamais prod). Convention partagée avec
// les seeds clients (ressources/media/cast) : mêmes id/email/accountType.
// À garder EN PHASE avec scripts/seed.mjs (JS pur, ne peut pas importer ce module).
export type PreviewUser = {
  id: string;
  email: string;
  name: string;
  accountType: "operator" | "audience";
};

export const PREVIEW_USERS: Record<"1" | "2" | "3", PreviewUser> = {
  "1": { id: "preview-op-1", email: "user1@avqn.ch", name: "User 1 (preview)", accountType: "operator" },
  "2": { id: "preview-op-2", email: "user2@avqn.ch", name: "User 2 (preview)", accountType: "operator" },
  "3": { id: "preview-aud-3", email: "user3@avqn.ch", name: "User 3 (preview)", accountType: "audience" },
};

export const PREVIEW_MARKER_COOKIE = "cos_preview_login";
export const PREVIEW_COOKIE_DOMAIN = ".preview.contentos.ch";
