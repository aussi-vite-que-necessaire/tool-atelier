import Link from 'next/link';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { listPublicationFormats } from '@/lib/db/repositories/publication-formats';

export default async function PublicationFormatsListPage() {
  const userId = await requireUserId();

  const formats = await listPublicationFormats(userId);

  return (
    <SettingsPage
      title="Formats de publication"
      description="Structure, intention visuelle et cosmétique par type de post."
      action={
        <Button nativeButton={false} render={<Link href="/cast/settings/formats/new" />}>
          + Nouveau
        </Button>
      }
    >
      {formats.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun format pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {formats.map((t) => (
            <li key={t.id}>
              <Link href={`/cast/settings/formats/${t.id}`} className="block">
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
