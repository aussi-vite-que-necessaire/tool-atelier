import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listStyleGuides } from '@/lib/db/repositories/style-guides';

export default async function StyleGuidesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const guides = await listStyleGuides(session.user.id);

  return (
    <SettingsPage
      title="Style guides"
      description="La langue visuelle (palette, typos, exemples) lue pour créer des templates cohérents."
      action={
        <Button nativeButton={false} render={<Link href="/settings/style-guides/new" />}>
          + Nouveau
        </Button>
      }
    >
      {guides.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun style guide pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {guides.map((g) => (
            <li key={g.id}>
              <Link href={`/settings/style-guides/${g.id}`} className="block">
                <Card className="p-4 transition-shadow hover:shadow-sm">
                  <p className="font-medium">{g.name}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
