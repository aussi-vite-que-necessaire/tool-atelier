import { CalendarDays, PenSquare } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { listPosts } from '@/lib/db/repositories/posts';
import { listPublicationsForCalendar } from '@/lib/db/repositories/publications';
import { buildDashboard } from '@/lib/home/dashboard';
import { getAuthorIdentity } from '@/lib/linkedin/identity';
import { DashboardStats } from './_components/dashboard-stats';
import { LastPublished } from './_components/last-published';
import { UpcomingPublications } from './_components/upcoming-publications';

const QUICK_ACTIONS = [
  { href: '/posts', label: 'Créer un post', icon: PenSquare, variant: 'default' as const },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays, variant: 'outline' as const },
];

export default async function DashboardPage() {
  const userId = await requireUserId();

  const [posts, pubs, author] = await Promise.all([
    listPosts(userId),
    listPublicationsForCalendar(userId),
    getAuthorIdentity(userId),
  ]);
  const { counts, upcoming, lastPublished } = buildDashboard(pubs);
  const drafts = posts.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Bonjour</h1>
        <p className="text-muted-foreground">
          Voici l’état de ton contenu — ce qui arrive et ce qui vient de partir.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={buttonVariants({ variant: action.variant, size: 'lg' })}
          >
            <action.icon className="size-4" />
            {action.label}
          </Link>
        ))}
      </div>

      <DashboardStats drafts={drafts} scheduled={counts.scheduled} published={counts.published} />

      <div className="grid gap-8 lg:grid-cols-2">
        <UpcomingPublications items={upcoming} />
        <LastPublished publication={lastPublished} author={author} />
      </div>
    </div>
  );
}
