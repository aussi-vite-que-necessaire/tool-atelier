# Refonte UX « Ajouter un visuel » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la modale-dans-modale d'ajout de visuel par une grande modale (rail par type + segments source), une grille de templates avec rendu HTML, et un composeur de génération IA deux panneaux réutilisé entre post et galerie.

**Architecture:** Composants client réutilisables (TemplatePicker, GenerateComposer, UploadDropzone, MediaPicker) assemblés dans `add-visual-dialog.tsx` (post) et dans la galerie. Le HTML de prévisualisation des templates est compilé **côté serveur** (`buildPreviewHtml` est server-only) dans la page post et passé au client. Les actions serveur et les queues existantes sont réutilisées telles quelles.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, Base UI Dialog, BullMQ (via actions existantes), Playwright (E2E), Biome, tsc.

**Note sur les tests :** le repo n'a pas de harnais de test unitaire React (pas de RTL). Les composants UI se valident par `npx tsc --noEmit`, `npx biome check .`, le build, et les specs Playwright E2E (avec stubs). La logique serveur (actions, queues) est déjà couverte et n'est pas modifiée. Chaque tâche se termine donc par tsc+biome+commit ; l'E2E global est en fin de plan.

---

## Décision de comportement (raffinée au planning)

La génération d'image **persiste toujours** l'image (le worker crée Media + ImageAsset). Donc :
- **Galerie** : « Générer » crée l'image → elle apparaît dans la galerie. Pas de bouton « ajouter », c'est automatique.
- **Post** : le GenerateComposer génère **sans** `postId` (les images vont dans la galerie + l'historique de session). L'utilisateur génère plusieurs essais, compare, puis **clique un essai pour l'attacher** au post (`attachExistingMediaAction`). C'est le flow « générer plusieurs, choisir un ».

---

## File Structure

Création :
- `src/app/(app)/posts/[id]/_components/template-thumbnail.tsx` — une vignette : iframe lazy-loadée (IntersectionObserver) + scale, bouton zoom, clic = select.
- `src/app/(app)/posts/[id]/_components/template-picker.tsx` — grille de vignettes + overlay zoom.
- `src/components/media/generate-composer.tsx` — composeur IA deux panneaux + historique session.
- `src/components/media/upload-dropzone.tsx` — input fichier stylé réutilisable.
- `src/components/media/media-picker.tsx` — grille galerie, mode `single` ou `multi` (carrousel).

Modification :
- `src/app/(app)/posts/[id]/page.tsx` — charge settings (brand), construit `templatePreviews` côté serveur, les passe à `PostEditor`.
- `src/app/(app)/posts/[id]/_components/post-editor.tsx` — passe `templatePreviews` à `AddVisualDialog`.
- `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` — grande modale rail+segments assemblant les briques.
- `src/app/(app)/media/_components/gallery-add-button.tsx` — deux boutons (Importer / Générer).

Suppression :
- `src/components/media/add-image-dialog.tsx` — une fois ses usages remplacés.

Réutilisés tels quels : `media-actions.ts`, `media/actions.ts`, `template-preview.tsx` (pattern iframe), `buildPreviewHtml`, `variables-form.tsx`, `IMAGE_ASPECT_RATIOS`, `useJobPolling`.

---

## Task 1 : TemplateThumbnail (vignette iframe lazy-loadée)

**Files:**
- Create: `src/app/(app)/posts/[id]/_components/template-thumbnail.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export type TemplatePreview = {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  html: string;
};

type Props = {
  preview: TemplatePreview;
  displayWidth?: number;
  onSelect: (id: string) => void;
  onZoom: (preview: TemplatePreview) => void;
};

export function TemplateThumbnail({ preview, displayWidth = 200, onSelect, onZoom }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const scale = displayWidth / preview.width;

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  return (
    <div className="group relative rounded-lg border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onSelect(preview.id)}
        className="block w-full"
        aria-label={`Choisir ${preview.label}`}
      >
        <div
          ref={ref}
          className="overflow-hidden bg-neutral-50"
          style={{ width: displayWidth, height: Math.round(preview.height * scale) }}
        >
          {visible ? (
            <iframe
              title={preview.label}
              srcDoc={preview.html}
              sandbox=""
              scrolling="no"
              tabIndex={-1}
              style={{
                width: preview.width,
                height: preview.height,
                border: 0,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-neutral-100" />
          )}
        </div>
      </button>
      <div className="flex items-center justify-between px-2 py-1 text-xs">
        <span className="truncate font-medium">{preview.label}</span>
        <button
          type="button"
          onClick={() => onZoom(preview)}
          className="ml-1 shrink-0 rounded px-1 text-neutral-500 hover:bg-neutral-100"
          aria-label={`Agrandir ${preview.label}`}
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check src/app/\(app\)/posts/\[id\]/_components/template-thumbnail.tsx`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(app)/posts/[id]/_components/template-thumbnail.tsx"
git commit -m "🤖 feat(visual): vignette template iframe lazy-loadée"
```

---

## Task 2 : TemplatePicker (grille + overlay zoom)

**Files:**
- Create: `src/app/(app)/posts/[id]/_components/template-picker.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateThumbnail, type TemplatePreview } from './template-thumbnail';

type Props = {
  previews: TemplatePreview[];
  onSelect: (id: string) => void;
};

export function TemplatePicker({ previews, onSelect }: Props) {
  const [zoom, setZoom] = useState<TemplatePreview | null>(null);

  if (previews.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Aucun template disponible.</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/settings/visual-templates/new" />}
        >
          Créer un template
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
        {previews.map((p) => (
          <TemplateThumbnail key={p.id} preview={p} onSelect={onSelect} onZoom={setZoom} />
        ))}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setZoom(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white p-3"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <iframe
              title={zoom.label}
              srcDoc={zoom.html}
              sandbox=""
              scrolling="no"
              style={{
                width: zoom.width,
                height: zoom.height,
                border: 0,
                transform: `scale(${Math.min(640 / zoom.width, (window.innerHeight * 0.8) / zoom.height)})`,
                transformOrigin: '0 0',
              }}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => { onSelect(zoom.id); setZoom(null); }}>
                Choisir ce template
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check "src/app/(app)/posts/[id]/_components/template-picker.tsx"`
Expected: aucune erreur. (Si Biome se plaint de `window` dans le scale du zoom, c'est du code client — OK ; sinon remplacer par une largeur fixe `Math.min(640/zoom.width, 1)`.)

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(app)/posts/[id]/_components/template-picker.tsx"
git commit -m "🤖 feat(visual): TemplatePicker grille + overlay zoom"
```

---

## Task 3 : Construire les previews HTML côté serveur (page post)

**Files:**
- Modify: `src/app/(app)/posts/[id]/page.tsx`
- Modify: `src/app/(app)/posts/[id]/_components/post-editor.tsx`

- [ ] **Step 1 : Charger settings + construire `templatePreviews` dans la page**

Dans `page.tsx`, ajouter les imports :

```tsx
import { getSettings } from '@/lib/db/repositories/settings';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';
import type { TemplatePreview } from './_components/template-thumbnail';
```

Ajouter `getSettings(userId)` au `Promise.all` :

```tsx
const [templates, styles, galleryImagesRaw, latestPub, settings] = await Promise.all([
  listVisualTemplates(userId),
  listVisualStyles(userId),
  listStandaloneImages(userId),
  getLatestPublicationForPost(userId, post.id),
  getSettings(userId),
]);

const brand = {
  name: settings?.brandName ?? '',
  color: settings?.brandColor ?? '#000000',
  signature: settings?.brandSignature ?? null,
};

const templatePreviews: TemplatePreview[] = templates.map((t) => ({
  id: t.id,
  label: t.label,
  platform: t.platform,
  width: t.width,
  height: t.height,
  html: buildPreviewHtml(t, (t.sampleVars as Record<string, unknown>) ?? {}, brand),
}));
```

Passer `templatePreviews` au `PostEditor` :

```tsx
<PostEditor
  post={post}
  idea={idea}
  templates={templates}
  templatePreviews={templatePreviews}
  styles={styles.map((s) => ({ id: s.id, name: s.name }))}
  galleryImages={galleryImages}
  mediaInfo={mediaInfo}
/>
```

- [ ] **Step 2 : Propager le prop dans `post-editor.tsx`**

Ajouter `import type { TemplatePreview } from './template-thumbnail';`, ajouter `templatePreviews: TemplatePreview[]` au type des props et à la déstructuration, et le passer à `<AddVisualDialog ... templatePreviews={templatePreviews} />`.

- [ ] **Step 3 : Vérifier types**

Run: `npx tsc --noEmit`
Expected: une erreur attendue tant que `AddVisualDialog` n'accepte pas encore `templatePreviews` (corrigée Task 7). Vérifier qu'il n'y a pas d'AUTRE erreur que celle-là. Ne pas committer seul — ce changement se finalise avec Task 7.

---

## Task 4 : GenerateComposer (deux panneaux + historique session)

**Files:**
- Create: `src/components/media/generate-composer.tsx`

Le job `generate-image` renvoie `{ mediaId, signedUrl, width, height }` (voir `GenerateImageResult`). On génère **sans** `postId`. Chaque résultat est poussé dans l'historique de session (état local). Prop optionnel `onAttach(mediaId)` : si fourni (contexte post), chaque essai affiche un bouton « Attacher au post ». Prop `onGenerated()` : refresh galerie.

- [ ] **Step 1 : Écrire le composant**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { enqueueGenerateImageAction } from '@/app/(app)/media/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useJobPolling } from '@/hooks/use-job-polling';
import { IMAGE_ASPECT_RATIOS } from '@/lib/media/aspect-ratios';

type Style = { id: string; name: string };
type Result = { mediaId: string; signedUrl: string };

type Props = {
  styles: Style[];
  onGenerated?: () => void;
  onAttach?: (mediaId: string) => void;
  attaching?: boolean;
};

export function GenerateComposer({ styles, onGenerated, onAttach, attaching }: Props) {
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<string>(IMAGE_ASPECT_RATIOS[0]);
  const [styleId, setStyleId] = useState<string>('');
  const [jobKey, setJobKey] = useState<string | null>(null);
  const [enqueuing, startEnqueue] = useTransition();
  const [history, setHistory] = useState<Result[]>([]);

  useJobPolling(jobKey, {
    queue: 'generate-image',
    defaultToast: false,
    onCompleted: (result) => {
      setJobKey(null);
      if (
        result &&
        typeof result === 'object' &&
        'mediaId' in result &&
        'signedUrl' in result
      ) {
        const r = result as { mediaId: string; signedUrl: string };
        setHistory((h) => [{ mediaId: r.mediaId, signedUrl: r.signedUrl }, ...h]);
        onGenerated?.();
      }
    },
  });

  const working = enqueuing || jobKey !== null;

  const onGenerate = () => {
    startEnqueue(async () => {
      const r = await enqueueGenerateImageAction({
        prompt,
        aspectRatio: aspect,
        styleId: styleId || undefined,
      });
      if (r.status === 'error') toast.error(r.message);
      else setJobKey(r.jobKey);
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="gc-prompt">Décris l'image</Label>
          <Textarea
            id="gc-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-1">
          <Label>Style</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStyleId('')}
              className={`rounded-full border px-3 py-1 text-xs ${styleId === '' ? 'bg-neutral-900 text-white' : ''}`}
            >
              Aucun
            </button>
            {styles.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                className={`rounded-full border px-3 py-1 text-xs ${styleId === s.id ? 'bg-neutral-900 text-white' : ''}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Format</Label>
          <div className="flex gap-2">
            {IMAGE_ASPECT_RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setAspect(r)}
                className={`rounded-full border px-3 py-1 text-xs ${aspect === r ? 'bg-neutral-900 text-white' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={onGenerate} disabled={working || !prompt.trim()}>
          {working ? 'Génération…' : '✨ Générer'}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Essais de la session</Label>
        {history.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded border bg-neutral-50 text-xs text-muted-foreground">
            {working ? 'Génération en cours…' : 'Tes images générées apparaîtront ici.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {history.map((r) => (
              <div key={r.mediaId} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.signedUrl} alt="" className="w-full rounded border" />
                {onAttach && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={attaching}
                    onClick={() => onAttach(r.mediaId)}
                  >
                    Attacher au post
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check src/components/media/generate-composer.tsx`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/media/generate-composer.tsx
git commit -m "🤖 feat(visual): GenerateComposer deux panneaux + historique session"
```

---

## Task 5 : UploadDropzone

**Files:**
- Create: `src/components/media/upload-dropzone.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  accept: string;
  label: string;
  hint?: string;
  busy?: boolean;
  onFile: (file: File) => void;
};

export function UploadDropzone({ accept, label, hint, busy, onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Envoi…' : 'Choisir un fichier'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check src/components/media/upload-dropzone.tsx`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/media/upload-dropzone.tsx
git commit -m "🤖 feat(visual): UploadDropzone réutilisable"
```

---

## Task 6 : MediaPicker (mono + multi/carrousel)

**Files:**
- Create: `src/components/media/media-picker.tsx`

Extrait des grilles galerie/carrousel actuelles de `add-visual-dialog.tsx`. Garde la logique de verrou de proportion (ratio) du carrousel.

- [ ] **Step 1 : Écrire le composant**

```tsx
'use client';

export type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  signedUrl: string;
};

type SingleProps = {
  mode: 'single';
  images: GalleryImage[];
  disabled?: boolean;
  onPick: (mediaId: string) => void;
};

type MultiProps = {
  mode: 'multi';
  images: GalleryImage[];
  disabled?: boolean;
  selectedKeys: string[];
  onToggle: (assetKey: string) => void;
};

type Props = SingleProps | MultiProps;

function sameRatio(a: GalleryImage, b: GalleryImage) {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.02;
}

export function MediaPicker(props: Props) {
  if (props.images.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Galerie vide.</p>;
  }

  if (props.mode === 'single') {
    return (
      <div className="grid grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {props.images.map((img) => (
          <button
            key={img.mediaId}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPick(img.mediaId)}
            className="overflow-hidden rounded border hover:ring-2 disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.signedUrl} alt="" className="h-auto w-full" />
          </button>
        ))}
      </div>
    );
  }

  const lockedFormat = props.selectedKeys.length
    ? props.images.find((g) => g.assetKey === props.selectedKeys[0])
    : null;

  return (
    <div className="grid grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
      {props.images.map((img) => {
        const idx = props.selectedKeys.indexOf(img.assetKey);
        const selectable = !lockedFormat || sameRatio(img, lockedFormat) || idx >= 0;
        return (
          <button
            key={img.mediaId}
            type="button"
            disabled={!selectable || props.disabled}
            onClick={() => props.onToggle(img.assetKey)}
            className={`relative overflow-hidden rounded border disabled:opacity-30 ${idx >= 0 ? 'ring-2 ring-neutral-900' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.signedUrl} alt="" className="h-auto w-full" />
            {idx >= 0 && (
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
                {idx + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check src/components/media/media-picker.tsx`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/media/media-picker.tsx
git commit -m "🤖 feat(visual): MediaPicker mono + multi (carrousel)"
```

---

## Task 7 : Réassembler AddVisualDialog (grande modale rail + segments)

**Files:**
- Modify: `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` (réécriture complète)

Conserve toute la logique d'actions/jobs existante (preview/final/carrousel/vidéo/attach). Remplace l'UI : grande modale `max-w-5xl`, rail gauche (Image/Carrousel/Vidéo), segments source dans Image, et la sélection de template ouvre le `VariablesForm` + aperçu existant. Supprime `AddImageDialog`.

- [ ] **Step 1 : Réécrire le composant**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { GenerateComposer } from '@/components/media/generate-composer';
import { MediaPicker } from '@/components/media/media-picker';
import { UploadDropzone } from '@/components/media/upload-dropzone';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useJobPolling } from '@/hooks/use-job-polling';
import type { VisualTemplate } from '@/lib/db/schema';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import {
  attachExistingMediaAction,
  createCarouselAction,
  enqueuePostFinalAction,
  enqueuePostPreviewAction,
  uploadVideoAction,
} from '../media-actions';
import { uploadImageAction } from '@/app/(app)/media/actions';
import type { TemplatePreview } from './template-thumbnail';
import { TemplatePicker } from './template-picker';
import { VariablesForm } from './variables-form';

type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  signedUrl: string;
};
type Style = { id: string; name: string };
type VisualType = 'image' | 'carousel' | 'video';
type ImageSource = 'templates' | 'gallery' | 'ai' | 'upload';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  templates: VisualTemplate[];
  templatePreviews: TemplatePreview[];
  styles: Style[];
  galleryImages: GalleryImage[];
};

export function AddVisualDialog({
  open,
  onOpenChange,
  postId,
  templates,
  templatePreviews,
  styles,
  galleryImages,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<VisualType>('image');
  const [source, setSource] = useState<ImageSource>('templates');
  const [carouselKeys, setCarouselKeys] = useState<string[]>([]);
  const [attaching, startAttach] = useTransition();

  const [selected, setSelected] = useState<VisualTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [previewJobKey, setPreviewJobKey] = useState<string | null>(null);
  const [finalJobKey, setFinalJobKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enqueuing, start] = useTransition();

  useJobPolling(previewJobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: (result) => {
      if (
        result &&
        typeof result === 'object' &&
        'signedUrl' in result &&
        typeof (result as { signedUrl: unknown }).signedUrl === 'string'
      ) {
        setPreviewUrl((result as { signedUrl: string }).signedUrl);
      }
      setPreviewJobKey(null);
    },
  });

  useJobPolling(finalJobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: () => {
      toast.success('Visuel ajouté au post');
      setFinalJobKey(null);
      onOpenChange(false);
      reset();
    },
  });

  const reset = () => {
    setType('image');
    setSource('templates');
    setSelected(null);
    setVars({});
    setPreviewUrl(null);
    setPreviewJobKey(null);
    setFinalJobKey(null);
    setCarouselKeys([]);
  };

  const isWorking = enqueuing || previewJobKey !== null || finalJobKey !== null || attaching;

  const onSelectTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSelected(t);
    setVars((t.sampleVars as Record<string, unknown>) ?? {});
    setPreviewUrl(null);
  };

  const onPreview = () => {
    if (!selected) return;
    setPreviewUrl(null);
    start(async () => {
      const r = await enqueuePostPreviewAction({ templateId: selected.id, vars });
      if (r.status === 'error') toast.error(r.message);
      else setPreviewJobKey(r.jobKey);
    });
  };

  const onValidate = () => {
    if (!selected) return;
    start(async () => {
      const r = await enqueuePostFinalAction({ postId, templateId: selected.id, vars });
      if (r.status === 'error') toast.error(r.message);
      else setFinalJobKey(r.jobKey);
    });
  };

  const attachMedia = (mediaId: string) => {
    startAttach(async () => {
      const r = await attachExistingMediaAction({ postId, mediaId });
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Visuel attaché');
        onOpenChange(false);
        reset();
        router.refresh();
      }
    });
  };

  const onUploadImage = (file: File) => {
    startAttach(async () => {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('postId', postId);
      const r = await uploadImageAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Image ajoutée');
        onOpenChange(false);
        reset();
        router.refresh();
      }
    });
  };

  const onUploadVideo = (file: File) => {
    startAttach(async () => {
      const fd = new FormData();
      fd.set('postId', postId);
      fd.set('file', file);
      const r = await uploadVideoAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Vidéo ajoutée');
        onOpenChange(false);
        reset();
        router.refresh();
      }
    });
  };

  const onCreateCarousel = () => {
    startAttach(async () => {
      const r = await createCarouselAction({ postId, slideKeys: carouselKeys });
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Carrousel créé');
        onOpenChange(false);
        reset();
        router.refresh();
      }
    });
  };

  const toggleSlide = (assetKey: string) =>
    setCarouselKeys((keys) =>
      keys.includes(assetKey) ? keys.filter((k) => k !== assetKey) : [...keys, assetKey],
    );

  const RAIL: { id: VisualType; label: string }[] = [
    { id: 'image', label: 'Image' },
    { id: 'carousel', label: 'Carrousel' },
    { id: 'video', label: 'Vidéo' },
  ];
  const SEGMENTS: { id: ImageSource; label: string }[] = [
    { id: 'templates', label: 'Templates' },
    { id: 'gallery', label: 'Galerie' },
    { id: 'ai', label: 'Générer IA' },
    { id: 'upload', label: 'Upload' },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Ajouter un visuel</DialogTitle>
          <DialogDescription>
            {selected ? `Template : ${selected.label}` : 'Choisis un type puis une source.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4" style={{ minHeight: '60vh' }}>
          {/* Rail par type */}
          <nav className="w-32 shrink-0 space-y-1">
            {RAIL.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setType(r.id);
                  setSelected(null);
                }}
                className={`block w-full rounded-md px-3 py-2 text-left text-sm ${type === r.id ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
              >
                {r.label}
              </button>
            ))}
          </nav>

          {/* Contenu */}
          <div className="min-w-0 flex-1">
            {type === 'image' && !selected && (
              <>
                <div className="mb-3 flex gap-2">
                  {SEGMENTS.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={source === s.id ? 'default' : 'outline'}
                      onClick={() => setSource(s.id)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                {source === 'templates' && (
                  <TemplatePicker previews={templatePreviews} onSelect={onSelectTemplate} />
                )}
                {source === 'gallery' && (
                  <MediaPicker
                    mode="single"
                    images={galleryImages}
                    disabled={isWorking}
                    onPick={attachMedia}
                  />
                )}
                {source === 'ai' && (
                  <GenerateComposer
                    styles={styles}
                    onAttach={attachMedia}
                    attaching={attaching}
                  />
                )}
                {source === 'upload' && (
                  <UploadDropzone
                    accept="image/png,image/jpeg,image/webp"
                    label="Importe une image"
                    hint="PNG, JPEG ou WebP"
                    busy={attaching}
                    onFile={onUploadImage}
                  />
                )}
              </>
            )}

            {type === 'image' && selected && (
              <div className="grid grid-cols-2 gap-4">
                <VariablesForm
                  schema={selected.variablesSchema as VariableSpec[]}
                  initial={(selected.sampleVars as Record<string, unknown>) ?? {}}
                  galleryImages={galleryImages}
                  styles={styles}
                  onChange={setVars}
                />
                <div className="flex min-h-[200px] items-center justify-center rounded border bg-neutral-50 p-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="Aperçu" className="h-auto max-w-full" />
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Clique « Aperçu » pour générer.
                    </p>
                  )}
                </div>
              </div>
            )}

            {type === 'carousel' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Sélectionne ≥ 2 images de même proportion (ordre = ordre des slides).
                </p>
                <MediaPicker
                  mode="multi"
                  images={galleryImages}
                  disabled={isWorking}
                  selectedKeys={carouselKeys}
                  onToggle={toggleSlide}
                />
              </div>
            )}

            {type === 'video' && (
              <UploadDropzone
                accept="video/mp4"
                label="Importe une vidéo"
                hint="MP4, 500 Mo max"
                busy={attaching}
                onFile={onUploadVideo}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {type === 'carousel' && (
            <Button onClick={onCreateCarousel} disabled={carouselKeys.length < 2 || isWorking}>
              {isWorking ? 'Création…' : `Créer le carrousel (${carouselKeys.length})`}
            </Button>
          )}
          {type === 'image' && selected && (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={isWorking}>
                Changer de template
              </Button>
              <Button variant="outline" onClick={onPreview} disabled={isWorking}>
                {previewJobKey !== null ? 'Génération…' : 'Aperçu'}
              </Button>
              <Button onClick={onValidate} disabled={isWorking}>
                {finalJobKey !== null ? 'Attache…' : 'Valider et attacher'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check "src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx"`
Expected: aucune erreur (les changements Task 3 sont maintenant satisfaits).

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(app)/posts/[id]/page.tsx" "src/app/(app)/posts/[id]/_components/post-editor.tsx" "src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx"
git commit -m "🤖 feat(visual): grande modale ajouter un visuel (rail type + segments source)"
```

---

## Task 8 : Galerie — deux boutons (Importer / Générer)

**Files:**
- Modify: `src/app/(app)/media/_components/gallery-add-button.tsx` (réécriture)

- [ ] **Step 1 : Réécrire le composant**

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { uploadImageAction } from '@/app/(app)/media/actions';
import { GenerateComposer } from '@/components/media/generate-composer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Style = { id: string; name: string };

export function GalleryAddButton({ styles }: { styles: Style[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [genOpen, setGenOpen] = useState(false);

  const onFile = (file: File) => {
    const fd = new FormData();
    fd.set('file', file);
    startUpload(async () => {
      const r = await uploadImageAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Image importée');
        router.refresh();
      }
    });
  };

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? 'Envoi…' : '↑ Importer'}
      </Button>
      <Button onClick={() => setGenOpen(true)}>✨ Générer une image</Button>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Générer une image</DialogTitle>
          </DialogHeader>
          <GenerateComposer styles={styles} onGenerated={() => router.refresh()} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier types + lint**

Run: `npx tsc --noEmit && npx biome check "src/app/(app)/media/_components/gallery-add-button.tsx"`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(app)/media/_components/gallery-add-button.tsx"
git commit -m "🤖 feat(visual): galerie — boutons Importer + Générer (composeur deux panneaux)"
```

---

## Task 9 : Supprimer l'ancienne petite modale

**Files:**
- Delete: `src/components/media/add-image-dialog.tsx`

- [ ] **Step 1 : Vérifier qu'il n'y a plus d'usage**

Run: `grep -rn "add-image-dialog\|AddImageDialog" src/`
Expected: aucun résultat.

- [ ] **Step 2 : Supprimer le fichier**

```bash
git rm src/components/media/add-image-dialog.tsx
```

- [ ] **Step 3 : Vérifier types + lint + commit**

Run: `npx tsc --noEmit && npx biome check .`
Expected: aucune erreur.

```bash
git commit -m "🤖 refactor(visual): supprime la modale-dans-modale add-image-dialog"
```

---

## Task 10 : E2E + validation finale

**Files:**
- Modify: `test/e2e/media-gallery.spec.ts` (adapter aux deux boutons)
- Modify/Create: `test/e2e/post-visual.spec.ts` (adapter à la nouvelle modale)

- [ ] **Step 1 : Lire les specs E2E existantes**

Run: `sed -n '1,200p' test/e2e/media-gallery.spec.ts test/e2e/post-visual.spec.ts`
But avec l'outil Read. Repérer les sélecteurs qui visent l'ancienne UI : bouton « + Ajouter une image », onglets « Upload »/« Générer avec l'IA », et dans le post les boutons « Template/Upload-IA/Galerie/Carrousel/Vidéo ».

- [ ] **Step 2 : Mettre à jour media-gallery.spec.ts**

Adapter le flow d'ajout :
- Remplacer le clic sur « + Ajouter une image » + onglet IA par : clic sur « ✨ Générer une image » → la modale `Générer une image` s'ouvre → remplir le prompt → cliquer « ✨ Générer » → attendre qu'une image apparaisse dans l'historique de session (ou dans la galerie après refresh).
- Pour l'upload : déclencher l'input fichier caché via `page.locator('input[type=file]').setInputFiles(...)` (Playwright peut setInputFiles même sur un input caché) puis vérifier l'apparition dans la galerie.

Exemple de bloc génération (les stubs renvoient un PNG 1×1) :

```ts
await page.getByRole('button', { name: '✨ Générer une image' }).click();
await expect(page.getByRole('heading', { name: 'Générer une image' })).toBeVisible();
await page.locator('#gc-prompt').fill('un bureau minimaliste');
await page.getByRole('button', { name: '✨ Générer' }).click();
// le worker stub crée l'image ; elle apparaît dans l'historique de session
await expect(page.locator('img').first()).toBeVisible({ timeout: 10_000 });
```

- [ ] **Step 3 : Mettre à jour post-visual.spec.ts**

Adapter à la grande modale :
- Ouvrir la modale d'ajout de visuel depuis le post.
- Vérifier le rail (`Image`, `Carrousel`, `Vidéo`) et les segments (`Templates`, `Galerie`, `Générer IA`, `Upload`).
- Templates : attendre qu'au moins une vignette/iframe de template soit montée (scroller si besoin), cliquer une vignette → le `VariablesForm` + bouton « Valider et attacher » apparaissent → valider → toast « Visuel ajouté au post ».

Sélecteur iframe vignette : `page.locator('iframe[title]')` (le `title` = label du template).

- [ ] **Step 4 : Lancer la validation complète**

```bash
pkill -f "tsx watch"; pkill -f "next start"; sleep 1
npx tsc --noEmit
npx biome check .
npm run build
npx playwright test media-gallery post-visual
```
Expected: tsc/biome clean, build OK, E2E verts. (Tuer les workers orphelins avant l'E2E — flake connu.)

- [ ] **Step 5 : Vérification navigateur manuelle**

Lancer `npm run dev` + worker, ouvrir un post, vérifier visuellement : grande modale, rail, grille de templates avec rendus, zoom, génération IA deux panneaux, galerie deux boutons. (L'UI ne se valide pas en unit test : ce contrôle visuel est requis.)

- [ ] **Step 6 : Commit**

```bash
git add test/e2e/media-gallery.spec.ts test/e2e/post-visual.spec.ts
git commit -m "🤖 test(e2e): adapte galerie + post à la nouvelle UX visuelle"
```

---

## Self-Review

**Spec coverage :**
- Grande modale rail+segments → Task 7. ✓
- Grille templates rendu HTML lazy + zoom → Tasks 1, 2, 3. ✓
- GenerateComposer deux panneaux + historique → Task 4 ; réutilisé Tasks 7 (post) + 8 (galerie). ✓
- UploadDropzone → Task 5 ; MediaPicker mono/multi → Task 6. ✓
- Galerie deux boutons → Task 8. ✓
- Suppression modale-dans-modale → Task 9. ✓
- buildPreviewHtml server-only → Task 3 (construit dans la page post). ✓
- Tests E2E galerie + post → Task 10. ✓

**Cohérence des types :** `TemplatePreview` défini Task 1, importé Tasks 2/3/7. `GalleryImage` redéfini localement dans MediaPicker (Task 6) et add-visual-dialog (Task 7) — structures identiques (`mediaId, assetKey, width, height, signedUrl`). Les actions (`enqueuePostPreviewAction`, `enqueuePostFinalAction`, `attachExistingMediaAction`, `createCarouselAction`, `uploadVideoAction`, `uploadImageAction`, `enqueueGenerateImageAction`) ne changent pas de signature.

**Placeholders :** aucun TODO/TBD ; code complet par étape.

**Décision de comportement :** la génération IA dans le post ne passe plus `postId` (génère → galerie → l'utilisateur clique « Attacher au post »), différent de l'ancien comportement auto-attach. Signalé en tête de plan.
