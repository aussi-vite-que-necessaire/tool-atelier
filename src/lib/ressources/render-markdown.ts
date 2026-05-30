import { Marked, type Tokens } from 'marked';
import { Slugger } from './toc';

// Rend du markdown de ressource en HTML (synchrone), avec ancres sur les titres
// h2/h3 (compatibles avec la table des matières). Le contenu provient de
// l'opérateur authentifié (back-office). On crée une instance Marked par rendu
// pour que le Slugger (état mutable) reparte à zéro à chaque page.
export function renderReaderMarkdown(md: string): string {
  const slugger = new Slugger();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(
        this: { parser: { parseInline(t: Tokens.Generic[]): string } },
        token: Tokens.Heading,
      ) {
        const inner = this.parser.parseInline(token.tokens);
        if (token.depth === 2 || token.depth === 3) {
          const id = slugger.slug(token.text);
          return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
        }
        return `<h${token.depth}>${inner}</h${token.depth}>\n`;
      },
    },
  });
  return marked.parse(md, { async: false }) as string;
}
