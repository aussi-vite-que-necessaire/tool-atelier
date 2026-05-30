'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useJobPolling } from '@/hooks/use-job-polling';
import type { Publication } from '@/lib/db/schema';
import { cancelScheduleAction, publishNowAction, scheduleAction } from '../publish-actions';

type Props = { postId: string; publication: Publication | null };

function failureMessage(kind: string | null): string {
  if (kind === 'token_expired') return 'Ton accès LinkedIn a expiré.';
  if (kind === 'rate_limit') return 'LinkedIn a limité les requêtes, réessaie plus tard.';
  if (kind === 'invalid_content') return 'Contenu refusé par LinkedIn.';
  return 'La publication a échoué.';
}

export function PublishPanel({ postId, publication }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [when, setWhen] = useState('');

  const status = publication?.status;
  const isActive = status === 'queued' || status === 'publishing';

  useJobPolling(isActive && publication ? publication.id : null, {
    queue: 'publish-linkedin',
    defaultToast: false,
    onCompleted: () => router.refresh(),
  });

  function run(action: () => Promise<{ status: string; message?: string }>) {
    start(async () => {
      const r = await action();
      if (r.status === 'error') toast.error(r.message ?? 'Erreur');
      router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-medium text-sm">Publication LinkedIn</h2>

      {status === 'published' ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Publié
            {publication?.publishedAt
              ? ` le ${publication.publishedAt.toLocaleString('fr-FR')}`
              : ''}
            .
          </p>
          {publication?.externalUrl ? (
            <a
              href={publication.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Voir le post sur LinkedIn
            </a>
          ) : null}
        </div>
      ) : null}

      {status === 'scheduled' ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Planifié pour le{' '}
            {publication?.scheduledFor ? publication.scheduledFor.toLocaleString('fr-FR') : ''}.
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() => cancelScheduleAction({ postId, publicationId: publication!.id }))
            }
          >
            Annuler la planification
          </Button>
        </div>
      ) : null}

      {isActive ? <p className="text-muted-foreground text-sm">Publication en cours…</p> : null}

      {!status || status === 'failed' ? (
        <div className="space-y-3">
          {status === 'failed' ? (
            <p className="text-destructive text-sm">
              {failureMessage(publication?.failureKind ?? null)}{' '}
              {publication?.failureKind === 'token_expired' ? (
                <Link href="/account/connections" className="underline">
                  Reconnecte ton compte LinkedIn
                </Link>
              ) : null}
            </p>
          ) : null}

          <Button disabled={busy} onClick={() => run(() => publishNowAction(postId))}>
            Publier maintenant
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="max-w-[14rem]"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !when}
              onClick={() =>
                run(() =>
                  scheduleAction({
                    postId,
                    whenIso: new Date(when).toISOString(),
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  }),
                )
              }
            >
              Planifier
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
