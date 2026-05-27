'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/ui/code-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { TemplatePreview } from './_components/template-preview';
import { compileTemplateDraftAction } from './preview-actions';
import { SampleVarsEditor } from './sample-vars-editor';
import { VariablesSchemaEditor } from './variables-schema-editor';

export type VisualTemplateActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = {
  label: string;
  slug: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: VariableSpec[];
  sampleVars: string; // JSON brut
};

const EMPTY_INITIAL: Initial = {
  label: '',
  slug: '',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { font-size: 80px; }',
  variablesSchema: [],
  sampleVars: '{}',
};

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function VisualTemplateForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (
    prev: VisualTemplateActionState,
    formData: FormData,
  ) => Promise<VisualTemplateActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<VisualTemplateActionState, FormData>(action, {
    status: 'idle',
  });

  // État contrôlé des champs qui pilotent l'aperçu live.
  const [width, setWidth] = useState(values.width);
  const [height, setHeight] = useState(values.height);
  const [bodyHtml, setBodyHtml] = useState(values.bodyHtml);
  const [css, setCss] = useState(values.css);
  const [sampleVars, setSampleVars] = useState(values.sampleVars);
  const [schema, setSchema] = useState<VariableSpec[]>(values.variablesSchema);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'duplicate-slug') toast.error('Slug déjà utilisé');
      else if (state.message === 'validation') toast.error('Champs invalides');
      else toast.error(state.message);
    }
  }, [state, successMessage]);

  // Aperçu live : recompile (débounce) dès qu'un champ pertinent change.
  useEffect(() => {
    if (!width || !height) return;
    const handle = setTimeout(async () => {
      let parsedVars: Record<string, unknown>;
      try {
        parsedVars = JSON.parse(sampleVars || '{}');
      } catch {
        return; // JSON en cours d'édition : on garde le dernier aperçu valide
      }
      const r = await compileTemplateDraftAction({
        bodyHtml,
        css,
        width,
        height,
        variablesSchema: schema,
        sampleVars: parsedVars,
      });
      if (r.status === 'success') setPreviewHtml(r.html);
    }, 350);
    return () => clearTimeout(handle);
  }, [bodyHtml, css, width, height, sampleVars, schema]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]"
    >
      <div className="min-w-0 space-y-6">
        <SettingsCard title="Identité">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="label">Nom</Label>
                <Input id="label" name="label" defaultValue={values.label} maxLength={100} />
                {fieldErrors?.label && <p className="text-sm text-red-600">{fieldErrors.label}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={values.slug}
                  maxLength={60}
                  pattern="^[a-z0-9-]+$"
                />
                {fieldErrors?.slug && <p className="text-sm text-red-600">{fieldErrors.slug}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Plateforme</Label>
                <Input id="platform" name="platform" defaultValue={values.platform} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width (px)</Label>
                <Input
                  id="width"
                  name="width"
                  type="number"
                  min={1}
                  max={10000}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
                {fieldErrors?.width && <p className="text-sm text-red-600">{fieldErrors.width}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (px)</Label>
                <Input
                  id="height"
                  name="height"
                  type="number"
                  min={1}
                  max={10000}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
                {fieldErrors?.height && (
                  <p className="text-sm text-red-600">{fieldErrors.height}</p>
                )}
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Variables">
          <VariablesSchemaEditor
            name="variablesSchema"
            initial={values.variablesSchema}
            onChange={setSchema}
          />
          {fieldErrors?.variablesSchema && (
            <p className="mt-2 text-sm text-red-600">{fieldErrors.variablesSchema}</p>
          )}
        </SettingsCard>

        <SettingsCard title="Sample vars">
          <input type="hidden" name="sampleVars" value={sampleVars} />
          <SampleVarsEditor schema={schema} value={sampleVars} onChange={setSampleVars} />
          {fieldErrors?.sampleVars && (
            <p className="mt-2 text-sm text-red-600">{fieldErrors.sampleVars}</p>
          )}
        </SettingsCard>

        <details className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Code (HTML / CSS)
          </summary>
          <div className="mt-3 space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p className="font-medium text-neutral-700">Variables de marque</p>
              <p className="mt-1 text-neutral-500">
                Disponibles dans tout template, alimentées par l’identité de marque.
              </p>
              <ul className="mt-2 space-y-1 text-neutral-600">
                <li>
                  <code className="rounded bg-white px-1">{'{{brand.name}}'}</code> — nom de marque
                </li>
                <li>
                  <code className="rounded bg-white px-1">{'{{brand.signature}}'}</code> — signature
                </li>
                <li>
                  <code className="rounded bg-white px-1">{'{{brand.logo}}'}</code> — URL du logo
                  (dans <code className="rounded bg-white px-1">{'<img src="…">'}</code> ou{' '}
                  <code className="rounded bg-white px-1">background-image</code>)
                </li>
              </ul>
            </div>
            <input type="hidden" name="bodyHtml" value={bodyHtml} />
            <input type="hidden" name="css" value={css} />
            <div className="space-y-2">
              <Label htmlFor="bodyHtml">HTML (Handlebars)</Label>
              <CodeEditor id="bodyHtml" value={bodyHtml} onChange={setBodyHtml} language="markup" />
              {fieldErrors?.bodyHtml && (
                <p className="text-sm text-red-600">{fieldErrors.bodyHtml}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="css">CSS</Label>
              <CodeEditor id="css" value={css} onChange={setCss} language="css" />
              {fieldErrors?.css && <p className="text-sm text-red-600">{fieldErrors.css}</p>}
            </div>
          </div>
        </details>

        <SubmitButton mode={mode} />
      </div>

      <div className="min-w-0">
        <div className="sticky top-4">
          <div className="flex items-center justify-center rounded-lg border bg-neutral-50 px-3 py-6">
            {previewHtml && width > 0 && height > 0 ? (
              <TemplatePreview
                html={previewHtml}
                width={width}
                height={height}
                displayWidth={340}
              />
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">Aperçu…</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
