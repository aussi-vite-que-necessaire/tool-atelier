import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-code-window/index.ts).
// Text-only : titre brutaliste + fenêtre de code listant les keywords (type list).
export const linkedinCodeWindow: CreateVisualTemplateInput = {
  slug: 'linkedin-code-window',
  label: 'LinkedIn — Code window (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="title">{{title}}</div>
  <div class="window">
    <div class="titlebar">
      <div class="traffic">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      <div class="filename">{{filename}}</div>
      <div class="titlebar-spacer"></div>
    </div>
    <div class="code">
      <div class="line"><span class="lnum">1</span><span><span class="kw">export const</span> <span class="ident">{{varname}}</span> <span class="punct">=</span> <span class="punct">[</span></span></div>
      {{#each keywords}}
      <div class="line"><span class="lnum">&middot;</span><span class="indent"><span class="str">"{{this}}"</span><span class="punct">,</span></span></div>
      {{/each}}
      <div class="line"><span class="lnum">&nbsp;</span><span class="punct">]</span></div>
    </div>
  </div>
  <div class="signature">
    <span>{{signature}}</span>
    <span class="signature-right">{{filename}}</span>
  </div>
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  font-family: 'General Sans', -apple-system, sans-serif;
  padding: 80px 96px 80px 80px;
  display: flex;
  flex-direction: column;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 84px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: 0;
  word-spacing: 0.12em;
  color: #000;
  margin-bottom: 56px;
  max-height: 440px;
  overflow: hidden;
  white-space: pre-line;
}
.window {
  background: #fff;
  border: 1.5px solid #000;
  box-shadow: 16px 16px 0 #000;
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-bottom: 64px;
}
.titlebar {
  border-bottom: 1.5px solid #000;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  background: #f5f5f4;
}
.traffic { display: flex; gap: 10px; }
.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #000;
}
.filename {
  flex: 1;
  text-align: center;
  font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
  font-size: 20px;
  font-weight: 500;
  color: #525252;
  letter-spacing: 0.01em;
}
.titlebar-spacer { width: 72px; }
.code {
  flex: 1;
  padding: 52px 56px;
  font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
  font-size: 34px;
  line-height: 1.55;
  color: #000;
  overflow: hidden;
}
.line { display: flex; gap: 28px; align-items: baseline; }
.lnum {
  color: #a3a3a3;
  width: 36px;
  text-align: right;
  flex-shrink: 0;
  font-weight: 400;
  font-feature-settings: 'tnum';
}
.indent { padding-left: 40px; }
.kw { font-weight: 700; }
.ident { font-weight: 500; }
.str { font-weight: 500; }
.punct { color: #737373; font-weight: 400; }
.signature {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #000;
}
.signature-right { color: #737373; }`,
  variablesSchema: [
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 20,
      max: 110,
      description:
        'Titre brutaliste au-dessus de la fenêtre. Phrase courte et tranchée, 4 à 12 mots.',
    },
    {
      name: 'varname',
      label: 'Nom de variable',
      type: 'string',
      max: 24,
      description:
        'Identifiant TS reflétant la liste (keywords, tools, stack). camelCase, sans guillemets.',
    },
    {
      name: 'keywords',
      label: 'Items du tableau',
      type: 'list',
      minItems: 3,
      maxItems: 6,
      itemMin: 2,
      itemMax: 26,
      description:
        'Termes courts (kebab-case ou un mot) qui résument les thèmes ou outils du post.',
    },
    {
      name: 'filename',
      label: 'Nom de fichier (optionnel)',
      type: 'string',
      max: 28,
      optional: true,
      description: 'Affiché dans la title bar, ex "<sujet>.ts" (ts, py, sh, md).',
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 24,
      optional: true,
    },
  ],
  sampleVars: {
    title: 'Ma stack pour automatiser un solo business avec des agents IA',
    varname: 'stack',
    keywords: ['claude-agents', 'n8n', 'gmail-api', 'notion', 'typescript'],
    filename: 'stack.ts',
    signature: 'AVQN.CH',
  },
};
