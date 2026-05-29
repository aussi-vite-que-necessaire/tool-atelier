'use client';
/* @generated — synchronisé depuis packages/ui par bin/ui-sync. Ne pas éditer ici : modifier packages/ui puis relancer la synchro. */

import type * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * ConfirmDialog — modale de confirmation oui/non.
 *
 * Deux usages :
 *  - non contrôlé : fournir `trigger` (un élément cliquable). La modale gère son
 *    ouverture/fermeture seule.
 *  - contrôlé : piloter `open` + `onOpenChange` (utile pour une confirmation
 *    déclenchée par programme, ex. après un menu).
 *
 * `onConfirm` est appelé au clic sur le bouton de confirmation ; la modale se
 * ferme ensuite. `variant="destructive"` colore le bouton pour les actions
 * irréversibles (suppression…).
 */

export type ConfirmDialogProps = {
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm?: () => void;
};

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
          <DialogClose
            render={<Button variant={variant === 'destructive' ? 'destructive' : 'default'} />}
            onClick={() => onConfirm?.()}
          >
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
