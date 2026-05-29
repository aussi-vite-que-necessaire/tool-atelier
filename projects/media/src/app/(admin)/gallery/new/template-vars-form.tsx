"use client";

import type { VariablesSchema } from "@/lib/templates/dsl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Une image sélectionnable : la valeur stockée dans la variable est l'URL
// (les templates interpolent l'URL directement, ex. background-image:url('{{x}}')).
export type FormImage = { id: string; url: string };

interface Props {
  schema: VariablesSchema;
  values: Record<string, unknown>;
  images: FormImage[];
  onChange: (next: Record<string, unknown>) => void;
}

// Formulaire dynamique généré depuis le schéma de variables d'un template
// (string / list / color / image). Contrôlé : remonte l'objet de variables
// complet à chaque changement. Composant autonome, réutilisable hors de la modal.
export function TemplateVarsForm({ schema, values, images, onChange }: Props) {
  function set(name: string, value: unknown) {
    onChange({ ...values, [name]: value });
  }

  if (schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Ce template n&apos;a aucune variable.</p>
    );
  }

  return (
    <div className="space-y-4">
      {schema.map((v) => {
        const required = !("optional" in v && v.optional);
        return (
          <div key={v.name} className="space-y-1.5">
            <Label className="text-xs">
              {v.label}
              {required && <span className="text-destructive"> *</span>}
            </Label>
            {v.description && (
              <p className="text-xs text-muted-foreground">{v.description}</p>
            )}

            {v.type === "string" && (
              <Input
                type="text"
                value={asString(values[v.name])}
                maxLength={v.max}
                onChange={(e) => set(v.name, e.target.value)}
              />
            )}

            {v.type === "color" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={asColor(values[v.name], v.default)}
                  onChange={(e) => set(v.name, e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-transparent"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {asColor(values[v.name], v.default)}
                </span>
              </div>
            )}

            {v.type === "list" && (
              <ListField
                items={asList(values[v.name])}
                itemMax={v.itemMax}
                onChange={(items) => set(v.name, items)}
              />
            )}

            {v.type === "image" && (
              <ImagePicker
                images={images}
                value={asString(values[v.name])}
                onChange={(url) => set(v.name, url)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListField({
  items,
  itemMax,
  onChange,
}: {
  items: string[];
  itemMax?: number;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="text"
            value={item}
            maxLength={itemMax}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            title="Retirer"
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => onChange([...items, ""])}
      >
        + Ajouter
      </Button>
    </div>
  );
}

function ImagePicker({
  images,
  value,
  onChange,
}: {
  images: FormImage[];
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onChange("")}
        >
          Retirer l&apos;image
        </Button>
      )}
      <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-border bg-muted/50 p-2 sm:grid-cols-6">
        {images.length === 0 ? (
          <p className="col-span-full text-xs text-muted-foreground">
            Aucune image dans la galerie.
          </p>
        ) : (
          images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onChange(img.url)}
              className={cn(
                "aspect-square overflow-hidden rounded-md border-2",
                value === img.url
                  ? "border-primary"
                  : "border-transparent hover:border-ring",
              )}
              title="Choisir cette image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asColor(v: unknown, fallback?: string): string {
  if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback ?? "#000000";
}

function asList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.map((x) => (typeof x === "string" ? x : String(x)))
    : [];
}
