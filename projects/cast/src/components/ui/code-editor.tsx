'use client';

import Prism from 'prismjs';
import Editor from 'react-simple-code-editor';

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  language: 'markup' | 'css';
  maxHeight?: number;
};

// Éditeur de code avec coloration syntaxique (Prism) + hauteur max scrollable.
// Garde un vrai <textarea> (textareaId) pour rester pilotable/testable.
export function CodeEditor({ id, value, onChange, language, maxHeight = 320 }: Props) {
  return (
    <div
      className="code-editor overflow-auto rounded-md border border-neutral-200 bg-white"
      style={{ maxHeight }}
    >
      <Editor
        textareaId={id}
        value={value}
        onValueChange={onChange}
        highlight={(code) => Prism.highlight(code, Prism.languages[language]!, language)}
        padding={12}
        className="font-mono text-xs"
        style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}
      />
    </div>
  );
}
