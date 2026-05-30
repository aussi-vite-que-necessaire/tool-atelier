import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { buttonVariants } from '@/components/ui/button';
import type { CalendarPublication } from '@/lib/calendar/month-grid';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function LastPublished({
  publication,
  author,
}: {
  publication: CalendarPublication | null;
  author: LinkedInAuthor;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Dernier post publié</h2>
      {publication == null ? (
        <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun post publié pour l’instant.</p>
          <Link href="/cast/posts" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Créer un post
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {publication.publishedAt ? (
            <p className="text-sm text-muted-foreground">
              Publié le {formatDate(publication.publishedAt)}
            </p>
          ) : null}
          <LinkedInPostPreview
            author={author}
            content={publication.contentSnapshot}
            image={publication.thumbnailUrl ? { url: publication.thumbnailUrl } : null}
          />
          {publication.externalUrl ? (
            <Link
              href={publication.externalUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-4" />
              Voir sur LinkedIn
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
