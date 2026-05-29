'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { previewTemplateAction } from '../actions';

export function TemplatePreview({ templateId }: { templateId: string }) {
  const [state, action, pending] = useActionState(previewTemplateAction, {});

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Le rendu utilise les variables d'exemple sauvegardées (via le Chromium partagé). Enregistre
        d'abord, puis lance l'aperçu — l'image est aussi ajoutée à la galerie.
      </p>
      <form action={action}>
        <input type="hidden" name="id" value={templateId} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Rendu…' : 'Aperçu'}
        </Button>
      </form>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

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
