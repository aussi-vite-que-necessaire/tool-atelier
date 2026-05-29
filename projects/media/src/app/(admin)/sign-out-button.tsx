// Le logout est centralisé sur auth.contentos.ch (href calculé côté serveur :
// preview-logout en preview, home du provider en prod — cf. signOutUrl()).
export function SignOutButton({ href }: { href: string }) {
  return (
    <a href={href} className="text-muted-foreground hover:text-foreground">
      Déconnexion
    </a>
  );
}
