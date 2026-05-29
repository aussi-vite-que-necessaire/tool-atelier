"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papier indisponible */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 border-2 border-ink px-2 py-1 text-xs font-bold transition-colors ${
        copied ? "bg-accent text-accent-ink" : "bg-paper text-ink hover:bg-paper-2"
      }`}
    >
      {copied ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" strokeWidth={2.5} />}
      {copied ? "Copié" : label}
    </button>
  )
}
