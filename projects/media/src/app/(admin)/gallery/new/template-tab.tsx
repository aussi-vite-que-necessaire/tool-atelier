"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseVariablesSchema } from "@/lib/templates/dsl";
import { renderTemplateFromTemplateAction } from "../actions";
import { TemplateVarsForm, type FormImage } from "./template-vars-form";
import { TemplateLivePreview } from "./template-live-preview";

// Vue minimale d'un template nécessaire à l'onglet (le reste reste serveur).
export type TemplateOption = {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  variablesSchema: unknown[];
  sampleVars: Record<string, unknown>;
};

interface Props {
  templates: TemplateOption[];
  images: FormImage[];
}

// Onglet « Template » de la modal galerie : choisir un template, remplir ses
// variables et voir l'aperçu HTML live à côté, puis rendre l'image en galerie.
export function TemplateTab({ templates, images }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Le schéma peut être invalide (saisi à la main) → on protège le parse.
  const schema = useMemo(() => {
    if (!selected) return null;
    try {
      return parseVariablesSchema(selected.variablesSchema);
    } catch {
      return null;
    }
  }, [selected]);

  function pick(t: TemplateOption) {
    setSelectedId(t.id);
    setVars({ ...t.sampleVars });
    setError(null);
  }

  function back() {
    setSelectedId(null);
    setVars({});
    setError(null);
  }

  function render() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await renderTemplateFromTemplateAction(selected.id, vars);
      if (res.ok) {
        router.push("/gallery");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Grille de sélection.
  if (!selected) {
    if (templates.length === 0) {
      return (
        <p className="text-sm text-gray-400">
          Aucun template dans la bibliothèque. Crée-en un dans{" "}
          <span className="font-medium">Bibliothèque › Templates</span>.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Choisis un template</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t)}
              className="rounded border border-gray-200 p-3 text-left hover:border-gray-400 hover:bg-gray-50"
            >
              <div className="text-sm font-medium text-gray-800">{t.label}</div>
              <div className="mt-1 text-xs text-gray-400">
                {t.platform} · {t.width}×{t.height}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Formulaire + aperçu.
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Changer de template
        </button>
        <span className="text-sm font-medium text-gray-800">{selected.label}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulaire */}
        <div className="space-y-4">
          {schema ? (
            <TemplateVarsForm
              schema={schema}
              values={vars}
              images={images}
              onChange={setVars}
            />
          ) : (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Le schéma de variables de ce template est invalide.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={render}
            disabled={pending}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {pending ? "Rendu…" : "Ajouter à la galerie"}
          </button>
        </div>

        {/* Aperçu HTML live */}
        <TemplateLivePreview
          templateId={selected.id}
          vars={vars}
          width={selected.width}
          height={selected.height}
        />
      </div>
    </div>
  );
}
