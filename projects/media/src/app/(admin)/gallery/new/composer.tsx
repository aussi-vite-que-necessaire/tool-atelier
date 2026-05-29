"use client";

import { useMemo, useState, useTransition } from "react";
import { addImage, removeAt, moveUp, moveDown } from "./order";
import { composePdfAction, type ComposePdfResult } from "./pdf-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export type PickerImage = { id: string; url: string };

export function Composer({ images }: { images: PickerImage[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [result, setResult] = useState<ComposePdfResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const urlById = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) map.set(img.id, img.url);
    return map;
  }, [images]);

  const positionById = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [selected]);

  function build() {
    setResult(null);
    startTransition(async () => {
      const res = await composePdfAction(selected, tags);
      setResult(res);
      if (res.ok) {
        setSelected([]);
        setTags("");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Galerie cliquable */}
      <div className="space-y-3">
        <Heading level={4}>
          Galerie{" "}
          <span className="font-normal text-muted-foreground">({images.length})</span>
        </Heading>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune image PNG/JPEG dans la galerie.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img) => {
              const pos = positionById.get(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelected((s) => addImage(s, img.id))}
                  disabled={pos !== undefined}
                  className={cn(
                    "relative h-24 overflow-hidden rounded-lg border bg-muted",
                    pos !== undefined
                      ? "cursor-default border-primary"
                      : "border-border hover:border-ring",
                  )}
                  title={pos !== undefined ? `Page ${pos}` : "Ajouter au PDF"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.id} className="h-full w-full object-contain" />
                  {pos !== undefined && (
                    <span className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {pos}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Composition du PDF */}
      <div className="space-y-3">
        <Heading level={4}>
          PDF{" "}
          <span className="font-normal text-muted-foreground">
            ({selected.length} page{selected.length !== 1 ? "s" : ""})
          </span>
        </Heading>

        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Clique des images à gauche pour les ajouter, dans l&apos;ordre voulu.
          </p>
        ) : (
          <ol className="space-y-2">
            {selected.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-3 rounded-lg border border-border p-2"
              >
                <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlById.get(id)}
                    alt={id}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground" title={id}>
                  {id}
                </span>
                <div className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSelected((s) => moveUp(s, i))}
                    disabled={i === 0}
                    title="Monter"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setSelected((s) => moveDown(s, i))}
                    disabled={i === selected.length - 1}
                    title="Descendre"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    onClick={() => setSelected((s) => removeAt(s, i))}
                    title="Retirer"
                  >
                    ✕
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-1">
          <Label htmlFor="pdf-tags" className="text-xs text-muted-foreground">
            Tags (optionnel, séparés par des virgules)
          </Label>
          <Input
            id="pdf-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="brochure, client-x"
          />
        </div>

        <Button
          type="button"
          onClick={build}
          disabled={selected.length === 0 || isPending}
        >
          {isPending ? "Construction…" : "Construire le PDF"}
        </Button>

        {result?.ok && (
          <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p className="font-medium">PDF créé.</p>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ouvrir le PDF
            </a>
          </div>
        )}
        {result && !result.ok && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {result.error}
          </p>
        )}
      </div>
    </div>
  );
}
