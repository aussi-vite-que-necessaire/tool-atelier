'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateBrandSettings } from './actions';
import type { BrandActionState } from './actions-core';

type Initial = {
  brandName: string;
  brandSignature: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  );
}

export function BrandForm({ initialValues }: { initialValues: Initial }) {
  const [state, formAction] = useActionState<BrandActionState, FormData>(updateBrandSettings, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Identité de marque mise à jour');
    } else if (state.status === 'error') {
      toast.error(
        state.message === 'validation' ? 'Champs invalides' : 'Erreur lors de la sauvegarde',
      );
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form key={JSON.stringify(initialValues)} action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="brand_name">Nom de marque</Label>
        <Input
          id="brand_name"
          name="brand_name"
          type="text"
          defaultValue={initialValues.brandName}
          maxLength={100}
        />
        {fieldErrors?.brand_name && (
          <p className="text-sm text-red-600">{fieldErrors.brand_name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand_signature">Signature</Label>
        <Textarea
          id="brand_signature"
          name="brand_signature"
          defaultValue={initialValues.brandSignature}
          maxLength={1000}
          rows={3}
        />
        {fieldErrors?.brand_signature && (
          <p className="text-sm text-red-600">{fieldErrors.brand_signature}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
