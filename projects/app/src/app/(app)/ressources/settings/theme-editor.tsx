'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  COLOR_TOKENS,
  DEFAULT_PRESET_ID,
  FONT_MONO,
  FONT_SANS,
  PRESET_LIST,
  resolveTheme,
  type ThemeConfig,
  type ThemeTokens,
  themeToCss,
} from '@/lib/ressources/theme';
import { cn } from '@/lib/utils';
import { saveSettingsAction } from './actions';

const COLOR_LABELS: Record<(typeof COLOR_TOKENS)[number], string> = {
  paper: 'Fond',
  paper2: 'Fond 2',
  ink: 'Texte',
  inkSoft: 'Texte doux',
  accent: 'Accent',
  accentInk: 'Texte sur accent',
  accentSoft: 'Accent doux',
  info: 'Info',
  success: 'Succès',
  warn: 'Alerte',
};

const selectClass =
  'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none';

// oklch(...) n'est pas accepté par <input type=color> (qui veut du #hex). On
// édite les couleurs en hex via le color picker ; la valeur courante (oklch des
// presets incluse) reste lisible sous le champ.
export function ThemeEditor({
  initialBrandName,
  initialTheme,
}: {
  initialBrandName: string;
  initialTheme: ThemeConfig;
}) {
  const [brandName, setBrandName] = useState(initialBrandName);
  const [preset, setPreset] = useState(initialTheme.preset || DEFAULT_PRESET_ID);
  const [overrides, setOverrides] = useState<Partial<ThemeTokens>>(initialTheme.overrides ?? {});
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const config: ThemeConfig = useMemo(() => ({ preset, overrides }), [preset, overrides]);
  const tokens = useMemo(() => resolveTheme(config), [config]);
  const previewCss = useMemo(() => themeToCss(tokens), [tokens]);

  function setToken<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K] | undefined) {
    setSaved(false);
    setOverrides((o) => {
      const next = { ...o };
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  }

  // Changer de preset repart de zéro côté overrides (le preset EST le point de départ).
  function pickPreset(id: string) {
    setSaved(false);
    setPreset(id);
    setOverrides({});
  }

  function save() {
    setSaved(false);
    startTransition(async () => {
      const r = await saveSettingsAction({ brandName, theme: config });
      setSaved(r.ok);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Nom de marque</Label>
          <Input
            id="brandName"
            value={brandName}
            onChange={(e) => {
              setBrandName(e.target.value);
              setSaved(false);
            }}
            placeholder="Le nom affiché sur ton espace public"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Thème de départ</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESET_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p.id)}
                className={cn(
                  'rounded-lg border border-border p-3 text-left transition-colors',
                  preset === p.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
                )}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-xs opacity-80">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Couleurs (personnalisation)</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_TOKENS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-border p-2"
              >
                <input
                  type="color"
                  aria-label={COLOR_LABELS[key]}
                  className="size-9 cursor-pointer rounded border border-border bg-background"
                  onChange={(e) => setToken(key, e.target.value)}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-xs">{COLOR_LABELS[key]}</div>
                  <div className="truncate text-muted-foreground text-xs">{tokens[key]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fontSans">Police principale</Label>
            <select
              id="fontSans"
              value={tokens.fontSans}
              onChange={(e) => setToken('fontSans', e.target.value as ThemeTokens['fontSans'])}
              className={selectClass}
            >
              {FONT_SANS.map((f) => (
                <option key={f.id} value={f.stack}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fontMono">Police mono</Label>
            <select
              id="fontMono"
              value={tokens.fontMono}
              onChange={(e) => setToken('fontMono', e.target.value as ThemeTokens['fontMono'])}
              className={selectClass}
            >
              {FONT_MONO.map((f) => (
                <option key={f.id} value={f.stack}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="radius">Arrondi des angles</Label>
            <select
              id="radius"
              value={tokens.radius}
              onChange={(e) => setToken('radius', e.target.value)}
              className={selectClass}
            >
              {['0', '0.25rem', '0.5rem', '0.75rem', '1rem'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shadow">Style d’ombres</Label>
            <select
              id="shadow"
              value={tokens.shadowStyle}
              onChange={(e) =>
                setToken('shadowStyle', e.target.value as ThemeTokens['shadowStyle'])
              }
              className={selectClass}
            >
              <option value="brutal">Dures (brutal)</option>
              <option value="soft">Douces (soft)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {saved && <span className="font-medium text-muted-foreground text-xs">Enregistré ✓</span>}
        </div>
      </div>

      {/* Aperçu live : un sous-arbre avec les tokens --res-* résolus appliqués localement. */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <Label>Aperçu</Label>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: tokens validés (cssColor/cssRadius), préfixe --res- isolé */}
        <style dangerouslySetInnerHTML={{ __html: `.res-theme-preview{${previewCss}}` }} />
        <div
          className="res-theme-preview mt-1.5 overflow-hidden border p-5"
          style={{
            background: 'var(--res-paper)',
            color: 'var(--res-ink)',
            borderColor: 'var(--res-ink)',
            borderRadius: 'var(--res-radius)',
            fontFamily: 'var(--res-font-sans)',
          }}
        >
          <div className="font-bold text-xs" style={{ color: 'var(--res-accent)' }}>
            {brandName || 'Ta marque'}
          </div>
          <h3 className="mt-2 font-black text-xl" style={{ letterSpacing: '-0.02em' }}>
            Titre de ressource
          </h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--res-ink-soft)' }}>
            Un paragraphe d’exemple pour visualiser le rendu de ton espace.
          </p>
          <span
            className="mt-4 inline-block px-3 py-1.5 font-bold text-xs uppercase"
            style={{
              background: 'var(--res-accent)',
              color: 'var(--res-accent-ink)',
              borderRadius: 'var(--res-radius)',
            }}
          >
            Bouton
          </span>
        </div>
      </div>
    </div>
  );
}
