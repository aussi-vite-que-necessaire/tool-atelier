'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Content = Record<string, unknown>;
type ModuleData = { id?: string; type: string; content: Content };

const TYPES = [
  'markdown',
  'callout',
  'image',
  'video',
  'file',
  'embed',
  'code',
  'prompt',
  'accordion',
  'steps',
  'comparison',
  'quote',
  'cta',
  'gallery',
];

function defaultContent(type: string): Content {
  switch (type) {
    case 'markdown':
      return { md: '' };
    case 'callout':
      return { variant: 'info', md: '' };
    case 'image':
      return { url: '' };
    case 'video':
      return { url: '' };
    case 'file':
      return { url: '', label: '', filename: '' };
    case 'embed':
      return { url: '' };
    case 'code':
      return { language: 'ts', code: '' };
    case 'prompt':
      return { prompt: '' };
    case 'accordion':
      return { title: '', md: '' };
    case 'steps':
      return { steps: [{ title: '', md: '' }] };
    case 'comparison':
      return {
        columns: [
          { title: '', md: '' },
          { title: '', md: '' },
        ],
      };
    case 'quote':
      return { text: '' };
    case 'cta':
      return { label: '', url: '', variant: 'primary' };
    case 'gallery':
      return { images: [{ url: '' }] };
    default:
      return {};
  }
}

const selectClass =
  'rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none';

export function ModuleForm({
  action,
  resourceSlug,
  path,
  module,
}: {
  action: (formData: FormData) => void | Promise<void>;
  resourceSlug: string;
  path: string[];
  module?: ModuleData;
}) {
  const [type, setType] = useState(module?.type ?? 'markdown');
  const [content, setContent] = useState<Content>(
    module?.content ?? defaultContent(module?.type ?? 'markdown'),
  );
  const editing = !!module?.id;
  const c = content as Record<string, string>;

  function changeType(t: string) {
    setType(t);
    setContent(defaultContent(t));
  }
  const set = (patch: Content) => setContent((cur) => ({ ...cur, ...patch }));

  return (
    <form action={action} className="space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
      <input type="hidden" name="path" value={path.join('/')} />
      {editing && <input type="hidden" name="id" value={module?.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />

      {editing ? (
        <div className="font-semibold text-xs">{type}</div>
      ) : (
        <select value={type} onChange={(e) => changeType(e.target.value)} className={selectClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      {(type === 'markdown' || type === 'accordion') && (
        <>
          {type === 'accordion' && (
            <Input
              value={c.title ?? ''}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Titre"
            />
          )}
          <Textarea
            value={c.md ?? ''}
            onChange={(e) => set({ md: e.target.value })}
            rows={5}
            placeholder="Markdown…"
          />
        </>
      )}
      {type === 'callout' && (
        <>
          <select
            value={c.variant ?? 'info'}
            onChange={(e) => set({ variant: e.target.value })}
            className={selectClass}
          >
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="success">success</option>
          </select>
          <Textarea
            value={c.md ?? ''}
            onChange={(e) => set({ md: e.target.value })}
            rows={4}
            placeholder="Markdown…"
          />
        </>
      )}
      {(type === 'image' || type === 'video' || type === 'file' || type === 'embed') && (
        <Input
          value={c.url ?? ''}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="URL (R2 / externe)"
        />
      )}
      {type === 'image' && (
        <>
          <Input
            value={c.alt ?? ''}
            onChange={(e) => set({ alt: e.target.value })}
            placeholder="alt"
          />
          <Input
            value={c.caption ?? ''}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="légende"
          />
        </>
      )}
      {type === 'video' && (
        <Input
          value={c.caption ?? ''}
          onChange={(e) => set({ caption: e.target.value })}
          placeholder="légende"
        />
      )}
      {type === 'file' && (
        <>
          <Input
            value={c.label ?? ''}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="libellé"
          />
          <Input
            value={c.filename ?? ''}
            onChange={(e) => set({ filename: e.target.value })}
            placeholder="nom de fichier"
          />
        </>
      )}
      {type === 'code' && (
        <>
          <Input
            value={c.language ?? ''}
            onChange={(e) => set({ language: e.target.value })}
            placeholder="langage (ts, bash, python…)"
          />
          <Input
            value={c.filename ?? ''}
            onChange={(e) => set({ filename: e.target.value })}
            placeholder="nom de fichier (optionnel)"
          />
          <Textarea
            value={c.code ?? ''}
            onChange={(e) => set({ code: e.target.value })}
            rows={6}
            placeholder="code…"
            className="font-mono text-xs"
          />
        </>
      )}
      {type === 'prompt' && (
        <>
          <Input
            value={c.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="titre (optionnel)"
          />
          <Textarea
            value={c.prompt ?? ''}
            onChange={(e) => set({ prompt: e.target.value })}
            rows={6}
            placeholder="prompt à copier…"
          />
        </>
      )}
      {type === 'quote' && (
        <>
          <Textarea
            value={c.text ?? ''}
            onChange={(e) => set({ text: e.target.value })}
            rows={3}
            placeholder="citation"
          />
          <Input
            value={c.author ?? ''}
            onChange={(e) => set({ author: e.target.value })}
            placeholder="auteur"
          />
          <Input
            value={c.source ?? ''}
            onChange={(e) => set({ source: e.target.value })}
            placeholder="source"
          />
          <Input
            value={c.url ?? ''}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="url (optionnel)"
          />
        </>
      )}
      {type === 'cta' && (
        <>
          <Input
            value={c.label ?? ''}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="libellé du bouton"
          />
          <Input
            value={c.url ?? ''}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="url"
          />
          <select
            value={c.variant ?? 'primary'}
            onChange={(e) => set({ variant: e.target.value })}
            className={selectClass}
          >
            <option value="primary">primary</option>
            <option value="secondary">secondary</option>
          </select>
        </>
      )}

      {type === 'steps' && (
        <RowsEditor
          rows={(content.steps as { title: string; md: string }[]) ?? []}
          onChange={(rows) => set({ steps: rows })}
          empty={{ title: '', md: '' }}
          render={(row, upd) => (
            <>
              <Input
                value={row.title}
                onChange={(e) => upd({ title: e.target.value })}
                placeholder="titre de l’étape"
              />
              <Textarea
                value={row.md}
                onChange={(e) => upd({ md: e.target.value })}
                rows={3}
                placeholder="contenu (markdown)"
              />
            </>
          )}
        />
      )}
      {type === 'comparison' && (
        <RowsEditor
          rows={(content.columns as { title: string; md: string }[]) ?? []}
          onChange={(rows) => set({ columns: rows })}
          empty={{ title: '', md: '' }}
          min={2}
          max={3}
          render={(row, upd) => (
            <>
              <Input
                value={row.title}
                onChange={(e) => upd({ title: e.target.value })}
                placeholder="titre de colonne"
              />
              <Textarea
                value={row.md}
                onChange={(e) => upd({ md: e.target.value })}
                rows={3}
                placeholder="contenu (markdown)"
              />
            </>
          )}
        />
      )}
      {type === 'gallery' && (
        <RowsEditor
          rows={(content.images as { url: string; caption?: string }[]) ?? []}
          onChange={(rows) => set({ images: rows })}
          empty={{ url: '' }}
          render={(row, upd) => (
            <>
              <Input
                value={row.url}
                onChange={(e) => upd({ url: e.target.value })}
                placeholder="url image (R2)"
              />
              <Input
                value={row.caption ?? ''}
                onChange={(e) => upd({ caption: e.target.value })}
                placeholder="légende"
              />
            </>
          )}
        />
      )}

      <Button type="submit" size="sm">
        {editing ? 'Enregistrer' : 'Ajouter le module'}
      </Button>
    </form>
  );
}

function RowsEditor<T>({
  rows,
  onChange,
  empty,
  render,
  min = 1,
  max = 99,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: T;
  render: (row: T, upd: (patch: Partial<T>) => void) => React.ReactNode;
  min?: number;
  max?: number;
}) {
  const upd = (i: number, patch: Partial<T>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => {
    if (rows.length < max) onChange([...rows, { ...empty }]);
  };
  const remove = (i: number) => {
    if (rows.length > min) onChange(rows.filter((_, j) => j !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes éphémères sans id stable
        <div key={i} className="space-y-1 rounded-lg border border-border border-dashed p-2">
          <div className="flex justify-end gap-1">
            <Button type="button" size="icon-xs" variant="outline" onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button type="button" size="icon-xs" variant="outline" onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button type="button" size="icon-xs" variant="outline" onClick={() => remove(i)}>
              ✕
            </Button>
          </div>
          {render(row, (patch) => upd(i, patch))}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add}>
        + Ajouter
      </Button>
    </div>
  );
}
