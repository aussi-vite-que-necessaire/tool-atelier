'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

function parse(value: string): Record<string, unknown> {
  try {
    const o = JSON.parse(value);
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Édite les valeurs d'exemple via un formulaire (un champ par variable du
// schéma) plutôt qu'un JSON brut. Sérialise en JSON pour le hidden input + preview.
export function SampleVarsEditor({
  schema,
  value,
  onChange,
}: {
  schema: VariableSpec[];
  value: string;
  onChange: (json: string) => void;
}) {
  const obj = parse(value);
  const set = (name: string, v: unknown) =>
    onChange(JSON.stringify({ ...obj, [name]: v }, null, 2));

  if (schema.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ajoute des variables pour renseigner leurs valeurs d'exemple.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {schema.map((spec) => {
        const v = obj[spec.name];
        const strv = typeof v === 'string' ? v : '';
        return (
          <div key={spec.name} className="space-y-1">
            <Label htmlFor={`sv-${spec.name}`}>
              {spec.label || spec.name}
              <span className="ml-2 font-normal text-xs text-neutral-400">{spec.name}</span>
            </Label>
            {spec.type === 'color' ? (
              <Input
                id={`sv-${spec.name}`}
                type="color"
                value={strv || '#000000'}
                onChange={(e) => set(spec.name, e.target.value)}
                className="h-10 w-20 p-1"
              />
            ) : spec.type === 'list' ? (
              <Textarea
                id={`sv-${spec.name}`}
                value={Array.isArray(v) ? (v as string[]).join('\n') : ''}
                onChange={(e) => set(spec.name, e.target.value.split('\n').filter(Boolean))}
                rows={3}
                placeholder="Un élément par ligne"
              />
            ) : spec.type === 'string' && spec.max > 80 ? (
              <Textarea
                id={`sv-${spec.name}`}
                value={strv}
                onChange={(e) => set(spec.name, e.target.value)}
                rows={3}
              />
            ) : (
              <Input
                id={`sv-${spec.name}`}
                value={strv}
                onChange={(e) => set(spec.name, e.target.value)}
                placeholder={spec.type === 'image' ? 'URL (optionnel)' : ''}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
