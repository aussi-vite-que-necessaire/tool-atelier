// Identités de test, preview/dev uniquement (jamais prod). Email/mot de passe
// connus : l'auto-login de preview ouvre une vraie session BetterAuth pour ces
// comptes. À garder EN PHASE avec scripts/seed-preview.mjs (JS pur, ne peut pas
// importer ce module) qui les crée dans les tables auth.
export type PreviewUser = {
  id: string;
  email: string;
  name: string;
  role: 'operator';
};

// Mot de passe partagé par tous les comptes de test (preview/dev seulement).
export const PREVIEW_PASSWORD = 'password';

export const PREVIEW_USERS: Record<'1' | '2', PreviewUser> = {
  '1': { id: 'preview-op-1', email: 'op@contentos.test', name: 'Opérateur 1', role: 'operator' },
  '2': { id: 'preview-op-2', email: 'op2@contentos.test', name: 'Opérateur 2', role: 'operator' },
};

// Opérateur auto-connecté par défaut sur cette app.
export const DEFAULT_PREVIEW_USER: '1' | '2' = '1';
