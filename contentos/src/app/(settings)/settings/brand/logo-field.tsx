'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { type LogoActionState, removeBrandLogo, uploadBrandLogo } from './actions';

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Envoi…' : 'Téléverser'}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      Supprimer
    </Button>
  );
}

export function LogoField({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const [uploadState, uploadAction] = useActionState<LogoActionState, FormData>(uploadBrandLogo, {
    status: 'idle',
  });
  const [removeState, removeAction] = useActionState<LogoActionState, FormData>(removeBrandLogo, {
    status: 'idle',
  });

  useEffect(() => {
    if (uploadState.status === 'success') toast.success('Logo mis à jour');
    else if (uploadState.status === 'error') toast.error(uploadState.message);
  }, [uploadState]);

  useEffect(() => {
    if (removeState.status === 'success') toast.success('Logo supprimé');
    else if (removeState.status === 'error') toast.error(removeState.message);
  }, [removeState]);

  return (
    <div className="space-y-3">
      <Label>Logo</Label>

      {initialLogoUrl ? (
        <div className="flex items-center gap-4">
          <img
            src={initialLogoUrl}
            alt="Logo de marque"
            className="h-16 w-16 rounded border bg-white object-contain p-1"
          />
          <form action={removeAction}>
            <RemoveButton />
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun logo. Une fois téléversé, disponible dans les templates via{' '}
          <code className="rounded bg-muted px-1">{'{{brand.logo}}'}</code>.
        </p>
      )}

      <form action={uploadAction} className="flex items-center gap-3">
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <UploadButton />
      </form>
    </div>
  );
}
