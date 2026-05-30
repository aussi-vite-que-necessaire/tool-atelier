'use client';

import { FileStack, LayoutTemplate, Plus, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CREATION_MODES, type CreationModeId } from '@/lib/media/creation-modes';
import { cn } from '@/lib/utils';

const ICONS: Record<CreationModeId, ReactNode> = {
  generate: <Sparkles className="h-5 w-5" />,
  import: <Upload className="h-5 w-5" />,
  template: <LayoutTemplate className="h-5 w-5" />,
  assemble: <FileStack className="h-5 w-5" />,
};

export function AddMediaLauncher({ geminiAvailable }: { geminiAvailable: boolean }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4" />
            Ajouter un élément
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un élément</DialogTitle>
          <DialogDescription>Choisis comment créer ton média.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {CREATION_MODES.map((mode) => {
            const disabled = mode.requiresGemini && !geminiAvailable;
            const inner = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  {ICONS[mode.id]}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground text-sm">{mode.label}</span>
                  <span className="block text-muted-foreground text-xs">
                    {disabled ? 'Indisponible ici (Gemini non configuré).' : mode.description}
                  </span>
                </span>
              </>
            );
            const base =
              'flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors';
            if (disabled) {
              return (
                <div
                  key={mode.id}
                  aria-disabled
                  className={cn(base, 'cursor-not-allowed opacity-50')}
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link key={mode.id} href={mode.href} className={cn(base, 'hover:bg-muted')}>
                {inner}
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
