"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MediaRecord } from "@/lib/media/types";
import { editAction, deleteMediaAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Les médias raster (image/render) sont agrandissables et éditables par IA.
function isRaster(kind: MediaRecord["kind"]): boolean {
  return kind === "image" || kind === "render";
}

export function GalleryGrid({ items }: { items: MediaRecord[] }) {
  const router = useRouter();
  const [enlarged, setEnlarged] = useState<MediaRecord | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun média pour l&apos;instant.</p>;
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteMediaAction(fd);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <Card key={item.id} size="sm" className="gap-0">
            {/* Aperçu */}
            <div className="flex h-40 items-center justify-center overflow-hidden bg-muted">
              {isRaster(item.kind) && (
                <button
                  type="button"
                  onClick={() => setEnlarged(item)}
                  className="h-full w-full"
                  title="Agrandir"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.prompt ?? item.id}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />
                </button>
              )}
              {item.kind === "video" && (
                <video src={item.url} controls className="h-full w-full object-contain" />
              )}
              {item.kind === "pdf" && (
                <div className="flex flex-col items-center gap-1 p-2 text-center">
                  <span className="text-3xl">📄</span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Ouvrir le PDF
                  </a>
                </div>
              )}
            </div>

            {/* Métadonnées + suppression */}
            <CardContent className="flex flex-1 flex-col gap-1 pt-3">
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">{item.kind}</span>
                </div>
                {item.width && item.height && (
                  <div>
                    {item.width}&times;{item.height}
                  </div>
                )}
                <div className="truncate font-mono" title={item.id}>
                  {item.id}
                </div>
              </div>
              <div className="mt-auto pt-2">
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
        <EnlargeDialog item={enlarged} onClose={() => setEnlarged(null)} />
      )}
    </>
  );
}

// Agrandissement + édition IA en chaîne : chaque édition crée une variante et bascule l'affichage dessus.
function EnlargeDialog({
  item,
  onClose,
}: {
  item: MediaRecord;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState({ id: item.id, url: item.url });
  const [state, action, pending] = useActionState(editAction, {});

  useEffect(() => {
    if (state.id && state.url) {
      setCurrent({ id: state.id, url: state.url });
    }
  }, [state.id, state.url]);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate font-mono text-xs text-muted-foreground" title={current.id}>
            {current.id}
          </DialogTitle>
        </DialogHeader>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt="Image agrandie"
          className="mx-auto max-h-[55vh] max-w-full rounded-lg ring-1 ring-foreground/10"
        />

        <form action={action} className="space-y-2">
          <input type="hidden" name="sourceId" value={current.id} />
          <Label htmlFor="edit-prompt">Éditer avec l&apos;IA</Label>
          <Textarea
            id="edit-prompt"
            key={current.id}
            name="prompt"
            required
            rows={2}
            placeholder="Décris la modification : ajoute…, change…, retire…"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Édition…" : "Éditer avec l'IA"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
