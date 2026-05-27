'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  accept: string;
  label: string;
  hint?: string;
  busy?: boolean;
  onFile: (file: File) => void;
};

export function UploadDropzone({ accept, label, hint, busy, onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Envoi…' : 'Choisir un fichier'}
      </Button>
    </div>
  );
}
