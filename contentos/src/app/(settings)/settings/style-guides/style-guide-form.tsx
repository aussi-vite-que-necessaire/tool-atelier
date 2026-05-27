'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type StyleGuideActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = { name: string; content: string };

const EMPTY_INITIAL: Initial = { name: '', content: '' };

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function StyleGuideForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (prev: StyleGuideActionState, formData: FormData) => Promise<StyleGuideActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<StyleGuideActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'validation') toast.error('Champs invalides');
      else toast.error('Erreur lors de la sauvegarde');
    }
  }, [state, successMessage]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form key={JSON.stringify(values)} action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" type="text" defaultValue={values.name} maxLength={100} />
        {fieldErrors?.name && <p className="text-sm text-red-600">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Contenu (markdown)</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={values.content}
          maxLength={50000}
          rows={20}
        />
        {fieldErrors?.content && <p className="text-sm text-red-600">{fieldErrors.content}</p>}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
