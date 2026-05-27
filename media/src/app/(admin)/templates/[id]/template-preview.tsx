"use client";

import { useActionState } from "react";
import { previewTemplateAction } from "../actions";

interface Props {
  templateId: string;
}

export function TemplatePreview({ templateId }: Props) {
  const [state, action, pending] = useActionState(previewTemplateAction, {});

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Le rendu utilise les variables d&apos;exemple sauvegardées. Enregistre d&apos;abord, puis
        lance l&apos;aperçu.
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={templateId} />
        <button
          type="submit"
          disabled={pending}
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Rendu…" : "Aperçu"}
        </button>
      </form>

      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      {state.url && (
        <img
          src={state.url}
          alt="Aperçu du template"
          className="max-w-full border border-gray-200 rounded"
        />
      )}
    </div>
  );
}
