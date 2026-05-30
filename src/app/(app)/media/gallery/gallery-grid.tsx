'use client';

import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { provenanceLabel } from '@/lib/media/provenance';
import type { MediaRecord } from '@/lib/media/types';
import { deleteMediaAction, editAction } from './actions';

export function GalleryGrid({
  items,
  geminiAvailable,
}: {
  items: MediaRecord[];
  geminiAvailable: boolean;
}) {
  const router = useRouter();
  const [enlarged, setEnlarged] = useState<MediaRecord | null>(null);
  const [, startDelete] = useTransition();

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground text-sm">
        Aucun média pour l'instant. Utilise le bouton « Ajouter un élément » pour en créer un.
      </p>
    );
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteMediaAction(fd);
      router.refresh();
      toast.success('Média supprimé');
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <Card key={item.id} size="sm" className="gap-0 overflow-hidden">
            <div className="relative flex h-40 items-center justify-center overflow-hidden bg-muted">
              {item.kind === 'image' && (
                <button
                  type="button"
                  onClick={() => setEnlarged(item)}
                  className="h-full w-full"
                  title="Agrandir"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.prompt ?? item.kind}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />
                </button>
              )}
              {item.kind === 'video' && (
                // biome-ignore lint/a11y/useMediaCaption: média utilisateur sans piste de sous-titres
                <video src={item.url} controls className="h-full w-full object-contain" />
              )}
              {item.kind === 'pdf' && (
                <div className="flex flex-col items-center gap-1 p-2 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs hover:underline"
                  >
                    Ouvrir le PDF
                  </a>
                </div>
              )}
            </div>

            <CardContent className="flex flex-1 flex-col gap-2 pt-3">
              <Badge variant="secondary">{provenanceLabel(item.source)}</Badge>
              {item.width && item.height && (
                <div className="text-muted-foreground text-xs">
                  {item.width}&times;{item.height}
                </div>
              )}
              <div className="mt-auto pt-1">
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" size="xs">
                      Supprimer
                    </Button>
                  }
                  variant="destructive"
                  title="Supprimer ce média ?"
                  description="Cette action est définitive."
                  confirmLabel="Oui, supprimer"
                  cancelLabel="Non"
                  onConfirm={() => handleDelete(item.id)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {enlarged && (
        <EnlargeDialog
          item={enlarged}
          geminiAvailable={geminiAvailable}
          onClose={() => {
            setEnlarged(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EnlargeDialog({
  item,
  geminiAvailable,
  onClose,
}: {
  item: MediaRecord;
  geminiAvailable: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState({ id: item.id, url: item.url });
  const [state, action, pending] = useActionState(editAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.url) {
      setCurrent({ id: state.id, url: state.url });
      toast.success('Variante créée');
    }
  }, [state]);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu</DialogTitle>
        </DialogHeader>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt="Média agrandi"
          className="mx-auto max-h-[55vh] max-w-full rounded-lg ring-1 ring-foreground/10"
        />

        {geminiAvailable ? (
          <form action={action} className="space-y-2">
            <input type="hidden" name="sourceId" value={current.id} />
            <Label htmlFor="edit-prompt">Éditer avec l'IA</Label>
            <Textarea
              id="edit-prompt"
              key={current.id}
              name="prompt"
              required
              rows={2}
              placeholder="Décris la modification : ajoute…, change…, retire…"
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Édition…' : "Éditer avec l'IA"}
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            L'édition IA est indisponible dans cet environnement.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
