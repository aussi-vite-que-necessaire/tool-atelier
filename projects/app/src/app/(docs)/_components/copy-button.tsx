'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wide hover:opacity-70"
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Copy className="size-3.5" strokeWidth={2.5} />
      )}
      {copied ? 'Copié' : label}
    </button>
  );
}
