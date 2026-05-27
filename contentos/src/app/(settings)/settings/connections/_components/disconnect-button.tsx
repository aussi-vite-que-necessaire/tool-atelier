'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { disconnectLinkedInAction } from '../actions';

export function DisconnectButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await disconnectLinkedInAction();
          toast.success('Compte LinkedIn déconnecté');
        })
      }
    >
      {pending ? 'Déconnexion…' : 'Déconnecter'}
    </Button>
  );
}
