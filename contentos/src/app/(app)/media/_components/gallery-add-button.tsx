'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
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
        <DialogContent className="max-w-4xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Générer une image</DialogTitle>
          </DialogHeader>
          <GenerateComposer styles={styles} onGenerated={() => router.refresh()} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
