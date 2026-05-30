'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type VoiceActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

type Initial = { name: string; content: string };

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function VoiceForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (prev: VoiceActionState, formData: FormData) => Promise<VoiceActionState>;
  successMessage: string;
}) {
  const values = initial ?? { name: '', content: '' };
  const [state, formAction] = useActionState<VoiceActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') toast.error(state.message);
  }, [state, successMessage]);

  return (
    <form key={JSON.stringify(values)} action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" type="text" defaultValue={values.name} maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Contenu</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={values.content}
          maxLength={8000}
          rows={16}
          className="font-mono text-sm"
        />
      </div>
      <SubmitButton mode={mode} />
    </form>
  );
}
