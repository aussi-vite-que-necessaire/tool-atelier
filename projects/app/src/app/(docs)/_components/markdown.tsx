import { renderReaderMarkdown } from '@/lib/ressources/render-markdown';

// Rend du markdown de ressource (auteur authentifié) en HTML, dans le conteneur
// stylé .res-prose. Le HTML est produit par marked côté serveur.
export function Markdown({ children }: { children: string }) {
  const html = renderReaderMarkdown(children);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: contenu de l'opérateur, échappé par marked
  return <div className="res-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
