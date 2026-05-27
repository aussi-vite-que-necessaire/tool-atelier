'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type WritingTemplateActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = {
  name: string;
  platform: string;
  structure: string;
  writingRules: string | null;
};

const EMPTY_INITIAL: Initial = {
  name: '',
  platform: 'linkedin',
  structure: '',
  writingRules: null,
};

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function WritingTemplateForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (
    prev: WritingTemplateActionState,
    formData: FormData,
  ) => Promise<WritingTemplateActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<WritingTemplateActionState, FormData>(action, {
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
        <Label htmlFor="platform">Plateforme</Label>
        <Input id="platform" name="platform" type="text" defaultValue={values.platform} readOnly />
      </div>

      <div className="space-y-2">
        <Label htmlFor="structure">Structure</Label>
        <Textarea
          id="structure"
          name="structure"
          defaultValue={values.structure}
          maxLength={5000}
          rows={10}
          className="font-mono text-sm"
        />
        {fieldErrors?.structure && <p className="text-sm text-red-600">{fieldErrors.structure}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="writingRules">Règles d'écriture (optionnel)</Label>
        <Textarea
          id="writingRules"
          name="writingRules"
          defaultValue={values.writingRules ?? ''}
          maxLength={5000}
          rows={6}
          className="font-mono text-sm"
        />
        {fieldErrors?.writingRules && (
          <p className="text-sm text-red-600">{fieldErrors.writingRules}</p>
        )}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
