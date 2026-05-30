'use client';

import { signOut } from '@/lib/auth-client';

// Déconnexion. En preview → /preview-logout (efface la session + pose le marqueur
// → chooser, plus d'auto-login). En prod → signOut() client puis retour à /signin.
// `preview` est résolu côté serveur (process.env.APP_ENV) et passé en prop.
export function SignOutButton({ preview, className }: { preview: boolean; className?: string }) {
  if (preview) {
    return (
      <a href="/preview-logout?redirect=%2F" className={className}>
        Déconnexion
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await signOut();
        window.location.href = '/signin';
      }}
    >
      Déconnexion
    </button>
  );
}
