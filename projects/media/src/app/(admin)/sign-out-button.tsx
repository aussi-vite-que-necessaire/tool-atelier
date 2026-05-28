// Le logout est centralisé sur auth.contentos.ch : on renvoie l'utilisateur
// vers la home du provider (qui propose la déconnexion + retour propre).
export function SignOutButton({ authUrl }: { authUrl: string }) {
  return (
    <a
      href={authUrl}
      className="text-sm text-gray-500 hover:text-gray-900"
    >
      Déconnexion
    </a>
  );
}
