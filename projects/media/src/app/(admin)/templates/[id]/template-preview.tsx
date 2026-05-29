"use client";

import { useActionState } from "react";
import { previewTemplateAction } from "../actions";
import { Button } from "@/components/ui/button";

interface Props {
  templateId: string;
}

export function TemplatePreview({ templateId }: Props) {
  const [state, action, pending] = useActionState(previewTemplateAction, {});

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Le rendu utilise les variables d&apos;exemple sauvegardées. Enregistre d&apos;abord, puis
        lance l&apos;aperçu.
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={templateId} />
        <Button type="submit" disabled={pending}>
          {pending ? "Rendu…" : "Aperçu"}
        </Button>
      </form>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url}
          alt="Aperçu du template"
          className="max-w-full rounded-lg ring-1 ring-foreground/10"
        />
      )}
    </div>
  );
}
