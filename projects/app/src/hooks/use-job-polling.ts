'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export type JobState = {
  id: string;
  queue: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number | object;
  result: unknown;
  error: string | null;
};

type Options = {
  queue: string;
  /** Appelé quand le job se termine avec succès. result est le retour du worker. */
  onCompleted?: (result: unknown) => void;
  /** Toast par défaut sur succès. Désactiver si onCompleted gère son propre toast. */
  defaultToast?: boolean;
};

export function useJobPolling(jobKey: string | null, opts: Options) {
  const [state, setState] = useState<JobState | null>(null);
  const router = useRouter();
  const { queue, defaultToast = true } = opts;

  // Stocke les callbacks et options changeants dans un ref pour éviter de
  // les mettre en deps de l'effet — sinon chaque re-render du parent
  // (déclenché par setState ci-dessous) cleanup et redémarre le poll
  // immédiatement, ce qui spam le serveur sans délai entre fetchs.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!jobKey) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/jobs/${jobKey}?queue=${queue}`);
          if (!res.ok) {
            if (!cancelled)
              setState({
                id: jobKey,
                queue,
                status: 'failed',
                progress: 0,
                result: null,
                error: `HTTP ${res.status}`,
              });
            return;
          }
          const json = (await res.json()) as JobState;
          if (cancelled) return;
          setState(json);

          if (json.status === 'completed') {
            if (defaultToast) {
              toast.success('Post créé', {
                action:
                  typeof json.result === 'object' && json.result && 'postId' in json.result
                    ? {
                        label: 'Voir',
                        onClick: () =>
                          router.push(`/cast/posts/${(json.result as { postId: string }).postId}`),
                      }
                    : undefined,
              });
            }
            optsRef.current.onCompleted?.(json.result);
            router.refresh();
            return;
          }
          if (json.status === 'failed') {
            toast.error(`Génération échouée : ${json.error ?? 'erreur inconnue'}`);
            return;
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(`Polling échoué : ${err instanceof Error ? err.message : 'erreur'}`);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // Volontairement minimal : seuls jobKey + queue déclenchent un
    // (re)démarrage de poll. defaultToast est lu une seule fois à l'entrée
    // dans l'effet (acceptable, n'est pas censé changer). onCompleted est
    // lu via ref pour ne pas redémarrer l'effet à chaque render parent.
  }, [jobKey, queue, defaultToast, router]);

  return state;
}
