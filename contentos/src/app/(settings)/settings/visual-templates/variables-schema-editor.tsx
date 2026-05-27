'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

type Props = {
  /** Nom du hidden input qui sera POSTé avec la valeur JSON. */
  name: string;
  initial?: VariableSpec[];
  /** Notifié à chaque changement (pour un aperçu live côté formulaire). */
  onChange?: (specs: VariableSpec[]) => void;
};

// Brouillon interne (superset) pour éviter les frictions d'union TS pendant
// l'édition. Sérialisé en VariableSpec propre selon le type.
type Draft = {
  name: string;
  label: string;
  description?: string;
  type: 'string' | 'image' | 'list' | 'color';
  min?: number;
  max?: number;
  optional?: boolean;
  // list (préservés au round-trip ; édition fine non exposée ici)
  itemMin?: number;
  itemMax?: number;
  minItems?: number;
  maxItems?: number;
  // color
  default?: string;
};

type Row = { uid: string; draft: Draft };

// uid pour les lignes ajoutées après le montage (jamais pendant le SSR/hydratation,
// donc un compteur incrémental suffit et reste déterministe côté client).
let uidCounter = 0;
const nextUid = () => `vs-new-${++uidCounter}`;

function toDraft(spec: VariableSpec): Draft {
  const base = {
    name: spec.name,
    label: spec.label,
    description: spec.description,
    optional: spec.optional,
  };
  if (spec.type === 'string') return { ...base, type: 'string', min: spec.min, max: spec.max };
  if (spec.type === 'list') {
    return {
      ...base,
      type: 'list',
      itemMin: spec.itemMin,
      itemMax: spec.itemMax,
      minItems: spec.minItems,
      maxItems: spec.maxItems,
    };
  }
  if (spec.type === 'color') return { ...base, type: 'color', default: spec.default };
  return { ...base, type: 'image' };
}

function toSpec(d: Draft): VariableSpec {
  const base = { name: d.name, label: d.label, description: d.description, optional: d.optional };
  if (d.type === 'image') return { ...base, type: 'image' };
  if (d.type === 'list') {
    return {
      ...base,
      type: 'list',
      itemMin: d.itemMin,
      itemMax: d.itemMax,
      minItems: d.minItems,
      maxItems: d.maxItems,
    };
  }
  if (d.type === 'color') return { ...base, type: 'color', default: d.default };
  return { ...base, type: 'string', min: d.min, max: d.max ?? 100 };
}

const TYPE_LABEL: Record<Draft['type'], string> = {
  string: 'texte',
  image: 'image',
  list: 'liste',
  color: 'couleur',
};

function summarize(d: Draft): string {
  const parts: string[] = [];
  if (d.type === 'string' && (d.min !== undefined || d.max !== undefined)) {
    parts.push(`${d.min ?? 0}–${d.max ?? '∞'}`);
  }
  if (d.optional) parts.push('opt');
  return parts.join(' · ');
}

export function VariablesSchemaEditor({ name, initial, onChange }: Props) {
  // uid déterministe par index pour les lignes initiales : identique côté
  // serveur et client (pas de Date.now() qui casserait l'hydratation).
  const [rows, setRows] = useState<Row[]>(() =>
    (initial ?? []).map((spec, i) => ({ uid: `vs-${i}`, draft: toDraft(spec) })),
  );
  const [openUid, setOpenUid] = useState<string | null>(null);

  const update = (uid: string, patch: Partial<Draft>) => {
    setRows((arr) =>
      arr.map((r) => (r.uid === uid ? { ...r, draft: { ...r.draft, ...patch } } : r)),
    );
  };
  const remove = (uid: string) => setRows((arr) => arr.filter((r) => r.uid !== uid));
  const add = () => {
    const uid = nextUid();
    setRows((arr) => [...arr, { uid, draft: { name: '', label: '', type: 'string', max: 100 } }]);
    setOpenUid(uid);
  };

  const specs = rows.map((r) => toSpec(r.draft));
  const serialized = JSON.stringify(specs);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.(JSON.parse(serialized) as VariableSpec[]);
  }, [serialized]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={serialized} />
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune variable. Clique sur + pour ajouter.</p>
      )}
      {rows.map(({ uid, draft: v }) => {
        const open = openUid === uid;
        return (
          <div key={uid} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenUid(open ? null : uid)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50"
            >
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
                {TYPE_LABEL[v.type]}
              </span>
              <span className="text-sm font-medium text-neutral-900">{v.name || '(sans nom)'}</span>
              {v.label && <span className="text-xs text-neutral-500">{v.label}</span>}
              <span className="ml-auto text-[10px] text-neutral-400">{summarize(v)}</span>
              <span className="text-xs text-neutral-400">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div className="space-y-2 border-t border-neutral-100 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`${uid}-type`}>Type</Label>
                    <Select
                      value={v.type}
                      onValueChange={(t) => update(uid, { type: (t as Draft['type']) ?? 'string' })}
                    >
                      <SelectTrigger id={`${uid}-type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">Texte</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="list">Liste</SelectItem>
                        <SelectItem value="color">Couleur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${uid}-name`}>Name</Label>
                    <Input
                      id={`${uid}-name`}
                      placeholder="ex: title"
                      value={v.name}
                      onChange={(e) => update(uid, { name: e.target.value })}
                      pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${uid}-label`}>Label</Label>
                    <Input
                      id={`${uid}-label`}
                      placeholder="ex: Titre"
                      value={v.label}
                      onChange={(e) => update(uid, { label: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${uid}-desc`}>Description (optionnel)</Label>
                  <Textarea
                    id={`${uid}-desc`}
                    value={v.description ?? ''}
                    onChange={(e) => update(uid, { description: e.target.value || undefined })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {v.type === 'string' && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor={`${uid}-min`}>Min</Label>
                        <Input
                          id={`${uid}-min`}
                          type="number"
                          value={v.min ?? ''}
                          onChange={(e) =>
                            update(uid, {
                              min: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${uid}-max`}>Max</Label>
                        <Input
                          id={`${uid}-max`}
                          type="number"
                          value={v.max ?? ''}
                          onChange={(e) => update(uid, { max: Number(e.target.value) })}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={v.optional ?? false}
                        onChange={(e) => update(uid, { optional: e.target.checked })}
                      />
                      optional
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(uid)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        + Ajouter une variable
      </Button>
    </div>
  );
}
