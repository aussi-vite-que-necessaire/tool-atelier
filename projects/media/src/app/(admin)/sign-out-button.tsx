// Le logout est centralisé sur auth.contentos.ch : on renvoie l'utilisateur
// vers la home du provider (qui propose la déconnexion + retour propre).
export function SignOutButton({ authUrl }: { authUrl: string }) {
  return (
    <a href={authUrl} className="text-muted-foreground hover:text-foreground">
      Déconnexion
    </a>
  );
}
