import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';

export default async function WritingTemplatesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const templates = await listWritingTemplates(session.user.id);

  return (
    <SettingsPage
      title="Templates d'écriture"
      description="Format et règles spécifiques par type de post."
      action={
        <Button nativeButton={false} render={<Link href="/settings/writing-templates/new" />}>
          + Nouveau
        </Button>
      }
    >
      {templates.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun template pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/settings/writing-templates/${t.id}`} className="block">
                <Card className="p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-neutral-500">{t.platform}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
