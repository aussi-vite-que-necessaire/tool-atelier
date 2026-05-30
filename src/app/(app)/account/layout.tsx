import { AccountNav } from './account-nav';

// Section Compte : sous-nav locale + contenu, dans une largeur cohérente avec le
// reste de la suite. La garde d'auth vit dans le layout (app) parent.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">{children}</div>
    </>
  );
}
