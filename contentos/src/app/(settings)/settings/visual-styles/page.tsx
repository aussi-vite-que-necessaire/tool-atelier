import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';

export default async function VisualStylesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const styles = await listVisualStyles(session.user.id);

  return (
    <SettingsPage
      title="Styles visuels"
      description="Mini-prompts injectés dans la pipeline d'image."
      action={
        <Button nativeButton={false} render={<Link href="/settings/visual-styles/new" />}>
          + Nouveau
        </Button>
      }
    >
      {styles.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun style pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {styles.map((s) => (
            <li key={s.id}>
              <Link href={`/settings/visual-styles/${s.id}`} className="block">
                <Card className="p-4 transition-shadow hover:shadow-sm">
                  <p className="font-medium">{s.name}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
