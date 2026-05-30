import { marked } from 'marked';

// Rend du markdown en HTML (synchrone). Utilisé pour l'aperçu d'un style guide
// dans le back-office. Le contenu provient de l'auteur authentifié.
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false });
}
