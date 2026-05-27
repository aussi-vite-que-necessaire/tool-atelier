'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { uploadImageAction } from '@/app/(app)/media/actions';
import { GenerateComposer } from '@/components/media/generate-composer';
import { UploadDropzone } from '@/components/media/upload-dropzone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

type GalleryImage = { mediaId: string; url: string };
type Style = { id: string; name: string };

type Props = {
  schema: VariableSpec[];
  initial: Record<string, unknown>;
  galleryImages: GalleryImage[];
  styles: Style[];
  onChange: (vars: Record<string, unknown>) => void;
};

function initialValue(spec: VariableSpec, initial: Record<string, unknown>): unknown {
  const raw = initial[spec.name];
  if (spec.type === 'list') return Array.isArray(raw) ? (raw as string[]) : [];
  if (spec.type === 'color') return typeof raw === 'string' ? raw : (spec.default ?? '#000000');
  return typeof raw === 'string' ? raw : '';
}

export function VariablesForm({ schema, initial, galleryImages, styles, onChange }: Props) {
  const [vars, setVars] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const v of schema) seed[v.name] = initialValue(v, initial);
    return seed;
  });
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  const update = (name: string, value: unknown) => {
    const next = { ...vars, [name]: value };
    setVars(next);
    onChange(next);
  };

  const uploadForVar = (name: string, file: File) => {
    const fd = new FormData();
    fd.set('file', file);
    startUpload(async () => {
      const r = await uploadImageAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        update(name, r.mediaId);
        toast.success('Image ajoutée');
        setAddOpenFor(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {schema.map((v) => {
        if (v.type === 'image') {
          const selected = vars[v.name] as string;
          return (
            <div key={v.name} className="space-y-1">
              <Label>
                {v.label}{' '}
                <span className="text-xs text-muted-foreground">
                  (image{v.optional ? ', opt' : ''})
                </span>
              </Label>
              {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
              {galleryImages.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {galleryImages.map((img) => (
                    <button
                      key={img.mediaId}
                      type="button"
                      onClick={() => update(v.name, img.mediaId)}
                      className={`border rounded overflow-hidden ${
                        selected === img.mediaId ? 'ring-2 ring-neutral-900' : ''
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="w-full h-auto" />
                    </button>
                  ))}
                </div>
              )}
              {selected && !galleryImages.some((g) => g.mediaId === selected) && (
                <p className="text-xs text-green-700">Image ajoutée ✓</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpenFor(v.name)}
              >
                Ajouter (upload / IA)
              </Button>
              <Dialog
                open={addOpenFor === v.name}
                onOpenChange={(o) => setAddOpenFor(o ? v.name : null)}
              >
                <DialogContent className="max-w-4xl sm:max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Ajouter une image</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <UploadDropzone
                      accept="image/png,image/jpeg,image/webp"
                      label="Importe une image"
                      hint="PNG, JPEG ou WebP"
                      busy={uploading}
                      onFile={(file) => uploadForVar(v.name, file)}
                    />
                    <GenerateComposer
                      styles={styles}
                      onAttach={(mediaId) => {
                        update(v.name, mediaId);
                        toast.success('Image ajoutée');
                        setAddOpenFor(null);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          );
        }

        if (v.type === 'color') {
          return (
            <div key={v.name} className="space-y-1">
              <Label htmlFor={`var-${v.name}`}>
                {v.label} <span className="text-xs text-muted-foreground">(couleur)</span>
              </Label>
              <Input
                id={`var-${v.name}`}
                type="color"
                value={(vars[v.name] as string) || v.default || '#000000'}
                onChange={(e) => update(v.name, e.target.value)}
                className="h-10 w-20 p-1"
              />
              {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
            </div>
          );
        }

        if (v.type === 'list') {
          const items = (vars[v.name] as string[]) ?? [];
          const atMax = v.maxItems !== undefined && items.length >= v.maxItems;
          return (
            <div key={v.name} className="space-y-1">
              <Label>
                {v.label}{' '}
                <span className="text-xs text-muted-foreground">
                  (liste{v.optional ? ', opt' : ''})
                </span>
              </Label>
              {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
              <div className="space-y-2">
                {items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste éditable simple
                  <div key={i} className="flex gap-2">
                    <Input
                      value={item}
                      maxLength={v.itemMax}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = e.target.value;
                        update(v.name, next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(
                          v.name,
                          items.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={atMax}
                  onClick={() => update(v.name, [...items, ''])}
                >
                  + Ajouter
                </Button>
              </div>
            </div>
          );
        }

        // string
        const isLong = v.max > 80;
        return (
          <div key={v.name} className="space-y-1">
            <Label htmlFor={`var-${v.name}`}>
              {v.label}{' '}
              <span className="text-xs text-muted-foreground">
                ({v.optional ? 'opt' : 'req'}, max {v.max})
              </span>
            </Label>
            {isLong ? (
              <Textarea
                id={`var-${v.name}`}
                value={(vars[v.name] as string) ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
                rows={3}
              />
            ) : (
              <Input
                id={`var-${v.name}`}
                value={(vars[v.name] as string) ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
              />
            )}
            {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
