'use client';

import { Upload } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadAction } from '../actions';
import { CreationSuccess } from '../creation-feedback';

export function ImportForm() {
  const [state, action, pending] = useActionState(uploadAction, {});
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.id !== lastSeen.current) {
      lastSeen.current = state.id;
      setDone(true);
    }
  }, [state]);

  return (
    <div className="space-y-4">
      {done && (
        <CreationSuccess
          message="Média importé et ajouté à la galerie."
          onContinue={() => {
            setDone(false);
            formRef.current?.reset();
          }}
        />
      )}
      <form ref={formRef} action={action} className="space-y-3">
        <Label htmlFor="media-file" className="text-muted-foreground text-xs">
          Fichier (image, PDF ou vidéo mp4)
        </Label>
        <input
          id="media-file"
          type="file"
          name="file"
          required
          accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground file:text-sm hover:file:bg-secondary/80"
        />
        <Button type="submit" disabled={pending}>
          <Upload className="h-4 w-4" />
          {pending ? 'Import…' : 'Importer'}
        </Button>
      </form>
    </div>
  );
}
