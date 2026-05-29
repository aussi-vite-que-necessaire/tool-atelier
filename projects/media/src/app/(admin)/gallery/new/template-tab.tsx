"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseVariablesSchema } from "@/lib/templates/dsl";
import { renderTemplateFromTemplateAction } from "../actions";
import { TemplateVarsForm, type FormImage } from "./template-vars-form";
import { TemplateLivePreview } from "./template-live-preview";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/typography";

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
        <p className="text-sm text-muted-foreground">
          Aucun template dans la bibliothèque. Crée-en un dans{" "}
          <span className="font-medium text-foreground">Bibliothèque › Templates</span>.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <Heading level={4}>Choisis un template</Heading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t)}
              className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-muted"
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
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
        <Button variant="ghost" size="sm" onClick={back}>
          ← Changer de template
        </Button>
        <span className="text-sm font-medium">{selected.label}</span>
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
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Le schéma de variables de ce template est invalide.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" onClick={render} disabled={pending}>
            {pending ? "Rendu…" : "Ajouter à la galerie"}
          </Button>
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
