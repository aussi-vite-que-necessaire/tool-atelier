'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function PreviewDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Aperçu du post</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
