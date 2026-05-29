"use client";

import type { VariablesSchema } from "@/lib/templates/dsl";

// Une image sélectionnable : la valeur stockée dans la variable est l'URL
// (les templates interpolent l'URL directement, ex. background-image:url('{{x}}')).
export type FormImage = { id: string; url: string };

interface Props {
  schema: VariablesSchema;
  values: Record<string, unknown>;
  images: FormImage[];
  onChange: (next: Record<string, unknown>) => void;
}

const inputClass =
  "block w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400";

// Formulaire dynamique généré depuis le schéma de variables d'un template
// (string / list / color / image). Contrôlé : remonte l'objet de variables
// complet à chaque changement. Composant autonome, réutilisable hors de la modal.
export function TemplateVarsForm({ schema, values, images, onChange }: Props) {
  function set(name: string, value: unknown) {
    onChange({ ...values, [name]: value });
  }

  if (schema.length === 0) {
    return (
      <p className="text-sm text-gray-400">Ce template n&apos;a aucune variable.</p>
    );
  }

  return (
    <div className="space-y-4">
      {schema.map((v) => {
        const required = !("optional" in v && v.optional);
        return (
          <div key={v.name} className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              {v.label}
              {required && <span className="text-red-500"> *</span>}
            </label>
            {v.description && (
              <p className="text-xs text-gray-400">{v.description}</p>
            )}

            {v.type === "string" && (
              <input
                type="text"
                value={asString(values[v.name])}
                maxLength={v.max}
                onChange={(e) => set(v.name, e.target.value)}
                className={inputClass}
              />
            )}

            {v.type === "color" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={asColor(values[v.name], v.default)}
                  onChange={(e) => set(v.name, e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-gray-300"
                />
                <span className="font-mono text-xs text-gray-500">
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
          <input
            type="text"
            value={item}
            maxLength={itemMax}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={`flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400`}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="px-1 text-red-600 hover:text-red-800"
            title="Retirer"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
      >
        + Ajouter
      </button>
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
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Retirer l&apos;image
        </button>
      )}
      <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 sm:grid-cols-6">
        {images.length === 0 ? (
          <p className="col-span-full text-xs text-gray-400">
            Aucune image dans la galerie.
          </p>
        ) : (
          images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onChange(img.url)}
              className={`aspect-square overflow-hidden rounded border-2 ${
                value === img.url
                  ? "border-gray-800"
                  : "border-transparent hover:border-gray-400"
              }`}
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
