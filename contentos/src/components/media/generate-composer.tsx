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
type Result = { mediaId: string; url: string };

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
      if (result && typeof result === 'object' && 'mediaId' in result && 'url' in result) {
        const r = result as { mediaId: string; url: string };
        setHistory((h) => [{ mediaId: r.mediaId, url: r.url }, ...h]);
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
                <img src={r.url} alt="" className="w-full rounded border" />
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
