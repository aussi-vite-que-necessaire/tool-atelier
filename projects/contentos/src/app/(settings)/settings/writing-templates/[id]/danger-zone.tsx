'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DangerZone({ deleteAction }: { deleteAction: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-red-700">Zone dangereuse</h3>
      <p className="text-sm text-neutral-600">La suppression est définitive.</p>
      <Button type="button" variant="destructive" onClick={() => dialogRef.current?.showModal()}>
        Supprimer ce template
      </Button>
      <dialog ref={dialogRef} className="rounded-md p-6 shadow-xl backdrop:bg-black/40">
        <p className="mb-4 text-sm">Confirmer la suppression ?</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1 text-sm"
            onClick={() => dialogRef.current?.close()}
          >
            Annuler
          </button>
          <form action={deleteAction}>
            <button type="submit" className="rounded bg-red-600 px-3 py-1 text-sm text-white">
              Supprimer
            </button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
