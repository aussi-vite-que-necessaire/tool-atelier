'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useJobPolling } from '@/hooks/use-job-polling';
import { deleteImageAction, enqueueEditImageAction } from '../actions';

type Props = {
  mediaId: string;
  url: string;
  isAi: boolean;
  createdAt: string;
};

export function ImageCard({ mediaId, url, isAi, createdAt }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [editOpen, setEditOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [editing, startEdit] = useTransition();
  const [editJobKey, setEditJobKey] = useState<string | null>(null);

  useJobPolling(editJobKey, {
    queue: 'generate-image',
    defaultToast: false,
    onCompleted: () => {
      toast.success('Image éditée');
      setEditJobKey(null);
      setEditOpen(false);
      setPrompt('');
      router.refresh();
    },
  });

  const onDelete = () => {
    start(async () => {
      const r = await deleteImageAction(mediaId);
      if (r.status === 'error') toast.error(r.message);
      else toast.success('Image supprimée');
      setOpen(false);
    });
  };

  const onEdit = () => {
    startEdit(async () => {
      const r = await enqueueEditImageAction({ mediaId, prompt });
      if (r.status === 'error') toast.error(r.message);
      else setEditJobKey(r.jobKey);
    });
  };

  const editWorking = editing || editJobKey !== null;

  return (
    <div className="border rounded overflow-hidden bg-white">
      <div className="bg-neutral-50 aspect-square flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-w-full max-h-full object-contain" />
      </div>
      <div className="p-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          {isAi ? 'IA' : 'Upload'} · {new Date(createdAt).toLocaleDateString('fr-FR')}
        </p>
        <div className="flex items-center gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="sm">
                  Éditer (IA)
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Éditer avec l'IA</DialogTitle>
                <DialogDescription>
                  Décris la modification. Une nouvelle image sera créée (l'originale est conservée).
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="ex: passe le fond en bleu nuit"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editWorking}>
                  Annuler
                </Button>
                <Button onClick={onEdit} disabled={editWorking || !prompt.trim()}>
                  {editWorking ? 'Édition…' : 'Éditer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="sm">
                  Supprimer
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer cette image ?</DialogTitle>
                <DialogDescription>
                  Elle sera retirée de la galerie et des posts qui l'utilisent.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={onDelete} disabled={pending}>
                  {pending ? 'Suppression…' : 'Supprimer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
