import Handlebars from 'handlebars';
import type { visualTemplates } from '@/lib/db/schema';
import type { Brand } from '../brand';
import { BASE_CSS } from './base-css';

type VisualTemplate = typeof visualTemplates.$inferSelect;

// Helpers globaux (registrés une seule fois au chargement du module).
Handlebars.registerHelper('escape', (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  ),
);
Handlebars.registerHelper('trim', (v: unknown) => String(v ?? '').trim());
Handlebars.registerHelper(
  'ifNotEmpty',
  function (this: unknown, v: unknown, opts: Handlebars.HelperOptions) {
    const s = String(v ?? '').trim();
    return s.length > 0 ? opts.fn(this) : opts.inverse(this);
  },
);

// Cache LRU keyé par contenu source (le source EST l'identité du compilé).
type CompiledTemplate = Handlebars.TemplateDelegate;
const compileCache = new Map<string, CompiledTemplate>();
const MAX_CACHE = 100;

function getCompiled(source: string): CompiledTemplate {
  const cached = compileCache.get(source);
  if (cached) return cached;
  const compiled = Handlebars.compile(source, { strict: true, noEscape: false });
  if (compileCache.size >= MAX_CACHE) {
    const firstKey = compileCache.keys().next().value;
    if (firstKey) compileCache.delete(firstKey);
  }
  compileCache.set(source, compiled);
  return compiled;
}

export type CompileInput = {
  template: VisualTemplate;
  vars: Record<string, unknown>;
  brand: Brand;
};

export function compileTemplate(input: CompileInput): string {
  const ctx = { ...input.vars, brand: input.brand };
  const bodyTpl = getCompiled(input.template.bodyHtml);
  const cssTpl = getCompiled(input.template.css);
  const body = bodyTpl(ctx);
  const css = cssTpl(ctx);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}
${css}</style>
</head>
<body style="width:${input.template.width}px;height:${input.template.height}px">${body}</body>
</html>`;
}
