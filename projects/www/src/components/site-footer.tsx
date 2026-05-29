// Footer partagé : crédit auteur (Emmanuel Bernard / avqn.ch) + lien styleguide.
export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 sm:flex-row">
        <p>
          Projet exploratoire d'Emmanuel Bernard ·{' '}
          <a href="https://avqn.ch" className="underline underline-offset-4 hover:text-foreground">
            avqn.ch
          </a>
        </p>
        <a
          href="https://styleguide.contentos.ch"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Styleguide
        </a>
      </div>
    </footer>
  );
}
