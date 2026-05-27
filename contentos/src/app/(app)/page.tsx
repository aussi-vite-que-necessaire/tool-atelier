import { headers } from 'next/headers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth/server';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const displayName = session?.user.name?.trim() || session?.user.email || 'inconnu';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Bienvenue, {displayName}</h2>
      <p className="text-neutral-600">
        Ton instance content-os est prête. Les fonctionnalités arriveront dans les prochains
        sprints.
      </p>
      <Button nativeButton={false} render={<Link href="/settings/brand" />}>
        Ouvrir les réglages
      </Button>
    </div>
  );
}
