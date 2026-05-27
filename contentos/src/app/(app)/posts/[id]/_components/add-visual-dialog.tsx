'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { uploadImageAction } from '@/app/(app)/media/actions';
import { TemplatePreview } from '@/app/(settings)/settings/visual-templates/_components/template-preview';
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
  renderTemplatePreviewHtmlAction,
  uploadCarouselPdfAction,
  uploadVideoAction,
} from '../media-actions';
import { TemplatePicker } from './template-picker';
import type { TemplatePreview as TemplatePreviewData } from './template-thumbnail';
import { VariablesForm } from './variables-form';

type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  url: string;
};
type Style = { id: string; name: string };
type VisualType = 'image' | 'carousel' | 'video';
type ImageSource = 'templates' | 'gallery' | 'ai' | 'upload';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  templates: VisualTemplate[];
  templatePreviews: TemplatePreviewData[];
  styles: Style[];
  galleryImages: GalleryImage[];
};

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
  const [carouselSource, setCarouselSource] = useState<'build' | 'upload'>('build');
  const [carouselKeys, setCarouselKeys] = useState<string[]>([]);
  const [attaching, startAttach] = useTransition();

  const [selected, setSelected] = useState<VisualTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [finalJobKey, setFinalJobKey] = useState<string | null>(null);
  const [enqueuing, start] = useTransition();

  const reset = () => {
    setType('image');
    setSource('templates');
    setCarouselSource('build');
    setSelected(null);
    setVars({});
    setPreviewHtml(null);
    setFinalJobKey(null);
    setCarouselKeys([]);
  };

  // Aperçu live : recompile le HTML du template (sans Puppeteer) à chaque
  // changement de variable, débounce léger pour ne pas spammer le serveur.
  useEffect(() => {
    if (!selected) return;
    const templateId = selected.id;
    const handle = setTimeout(async () => {
      const r = await renderTemplatePreviewHtmlAction({ templateId, vars });
      if (r.status === 'success') setPreviewHtml(r.html);
    }, 350);
    return () => clearTimeout(handle);
  }, [selected, vars]);

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

  const isWorking = enqueuing || finalJobKey !== null || attaching;

  const onSelectTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSelected(t);
    setVars((t.sampleVars as Record<string, unknown>) ?? {});
    setPreviewHtml(null);
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

  const onUploadCarouselPdf = (file: File) => {
    startAttach(async () => {
      const fd = new FormData();
      fd.set('postId', postId);
      fd.set('file', file);
      const r = await uploadCarouselPdfAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Carrousel PDF ajouté');
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Ajouter un visuel</DialogTitle>
          <DialogDescription>
            {selected ? `Template : ${selected.label}` : 'Choisis un type puis une source.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-4">
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

          <div className="min-w-0 flex-1 overflow-y-auto">
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
                  <GenerateComposer styles={styles} onAttach={attachMedia} attaching={attaching} />
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
                <div className="flex min-h-[200px] items-start justify-center rounded border bg-neutral-50 p-2">
                  {previewHtml ? (
                    <TemplatePreview
                      html={previewHtml}
                      width={selected.width}
                      height={selected.height}
                      displayWidth={360}
                    />
                  ) : (
                    <p className="self-center text-center text-xs text-muted-foreground">
                      Aperçu en cours…
                    </p>
                  )}
                </div>
              </div>
            )}

            {type === 'carousel' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={carouselSource === 'build' ? 'default' : 'outline'}
                    onClick={() => setCarouselSource('build')}
                  >
                    Construire
                  </Button>
                  <Button
                    size="sm"
                    variant={carouselSource === 'upload' ? 'default' : 'outline'}
                    onClick={() => setCarouselSource('upload')}
                  >
                    Upload PDF
                  </Button>
                </div>
                {carouselSource === 'build' ? (
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
                ) : (
                  <UploadDropzone
                    accept="application/pdf"
                    label="Importe un PDF"
                    hint="Document PDF prêt à publier (max 100 Mo)"
                    busy={attaching}
                    onFile={onUploadCarouselPdf}
                  />
                )}
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
          {type === 'carousel' && carouselSource === 'build' && (
            <Button onClick={onCreateCarousel} disabled={carouselKeys.length < 2 || isWorking}>
              {isWorking ? 'Création…' : `Créer le carrousel (${carouselKeys.length})`}
            </Button>
          )}
          {type === 'image' && selected && (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)} disabled={isWorking}>
                Changer de template
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
