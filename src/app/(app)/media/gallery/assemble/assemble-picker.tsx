'use client';

import { FileText } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { aggregatePdfAction } from '../actions';
import { CreationSuccess } from '../creation-feedback';

type ImageItem = { id: string; url: string; prompt: string | null };

export function AssemblePicker({ images }: { images: ImageItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [building, startBuild] = useTransition();

  if (images.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground text-sm">
        Aucune image dans la galerie. Génère ou importe d'abord des images à assembler.
      </p>
    );
  }

  function toggle(id: string) {
    setDone(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function buildPdf() {
    if (selected.length === 0) return;
    startBuild(async () => {
      const r = await aggregatePdfAction(selected);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSelected([]);
      setDone(true);
    });
  }

  return (
    <div className="space-y-4">
      {done && (
        <CreationSuccess
          message="PDF assemblé et ajouté à la galerie."
          onContinue={() => setDone(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {selected.length} image{selected.length !== 1 ? 's' : ''} sélectionnée
          {selected.length !== 1 ? 's' : ''} {selected.length > 0 && '(dans l’ordre)'}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          disabled={selected.length === 0 || building}
          onClick={buildPdf}
        >
          <FileText className="h-4 w-4" />
          {building ? 'Assemblage…' : 'Assembler en PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((item) => {
          const pos = selected.indexOf(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              title="Sélectionner"
              className={cn(
                'relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted',
                pos >= 0 && 'ring-2 ring-signal ring-inset',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.prompt ?? 'image'}
                className="h-full w-full cursor-pointer object-contain"
              />
              {pos >= 0 && (
                <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-signal font-medium text-signal-foreground text-xs">
                  {pos + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
