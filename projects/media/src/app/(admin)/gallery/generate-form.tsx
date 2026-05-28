"use client";

import { useActionState } from "react";
import { generateAction } from "./actions";

const RATIOS = ["1:1", "16:9", "9:16", "4:5", "4:3"];

interface StyleOption {
  id: string;
  name: string;
}

export function GenerateForm({ styles }: { styles: StyleOption[] }) {
  const [state, action, pending] = useActionState(generateAction, {});

  return (
    <div className="border border-gray-200 rounded p-4 space-y-3">
      <h2 className="text-sm font-medium">Générer avec l&apos;IA</h2>
      <form action={action} className="space-y-2">
        <textarea
          name="prompt"
          required
          rows={3}
          placeholder="Décris l'image : sujet, style, composition, couleurs, ambiance…"
          className="block w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Ratio
            <select
              name="aspectRatio"
              defaultValue="1:1"
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            Style
            <select
              name="styleId"
              defaultValue=""
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Aucun style</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Génération…" : "Générer"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url}
          alt="Image générée"
          className="max-w-full border border-gray-200 rounded"
        />
      )}
    </div>
  );
}
