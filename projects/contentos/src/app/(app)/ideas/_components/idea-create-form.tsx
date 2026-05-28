'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createIdeaAction } from '../actions';
import type { ActionState } from '../actions-core';

const INITIAL: ActionState = { status: 'idle' };

export function IdeaCreateForm() {
  const [state, formAction, isPending] = useActionState(createIdeaAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Idée capturée');
      formRef.current?.reset();
    } else if (state.status === 'error') {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Nouvelle idée</h2>
      <Input
        name="idea"
        placeholder="Titre de l'idée"
        required
        maxLength={500}
        disabled={isPending}
      />
      <Textarea
        name="brief"
        placeholder="Brief (optionnel) : angle, contexte, exemples..."
        rows={4}
        maxLength={20000}
        disabled={isPending}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Ajout...' : 'Ajouter'}
        </Button>
        <p className="text-xs text-muted-foreground">Tu pourras éditer le brief depuis la liste.</p>
      </div>
    </form>
  );
}
