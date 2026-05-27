'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useJobPolling } from '@/hooks/use-job-polling';
import { enqueuePreviewAction } from './[id]/preview-actions';

type Props = {
  templateId: string;
  sampleVars: Record<string, unknown>;
};

export function PreviewPanel({ templateId, sampleVars }: Props) {
  const [jobKey, setJobKey] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [enqueuing, start] = useTransition();

  useJobPolling(jobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: (result) => {
      if (
        result &&
        typeof result === 'object' &&
        'url' in result &&
        typeof (result as { url: unknown }).url === 'string'
      ) {
        setImgUrl((result as { url: string }).url);
        setOpen(true);
      }
      setJobKey(null);
    },
  });

  const onPreview = () => {
    setImgUrl(null);
    start(async () => {
      const r = await enqueuePreviewAction({ templateId, vars: sampleVars });
      if (r.status === 'error') toast.error(r.message);
      else setJobKey(r.jobKey);
    });
  };

  const isLoading = enqueuing || jobKey !== null;

  return (
    <>
      <Button onClick={onPreview} disabled={isLoading} variant="outline">
        {isLoading ? 'Génération…' : 'Prévisualiser avec sample_vars'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aperçu image</DialogTitle>
          </DialogHeader>
          {imgUrl && (
            <div className="flex justify-center rounded-lg border bg-neutral-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="Preview" className="max-h-[70vh] w-auto" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
