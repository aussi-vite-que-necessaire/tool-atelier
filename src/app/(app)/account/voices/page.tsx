import Link from 'next/link';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { listVoices } from '@/lib/db/repositories/voice';

export default async function VoicesPage() {
  const userId = await requireUserId();
  const voices = await listVoices(userId);

  return (
    <SettingsPage
      title="Voix éditoriales"
      description="Vos voix éditoriales, partagées dans toute la suite. L'agent en choisit une au moment de produire un contenu."
      action={
        <Button nativeButton={false} render={<Link href="/account/voices/new" />}>
          + Nouvelle
        </Button>
      }
    >
      {voices.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucune voix. Crées-en une.</p>
      ) : (
        <ul className="space-y-3">
          {voices.map((v) => (
            <li key={v.id}>
              <Link href={`/account/voices/${v.id}`} className="block">
                <Card className="p-4 transition-shadow hover:shadow-sm">
                  <p className="font-medium">{v.name}</p>
                  <p className="line-clamp-2 text-xs text-neutral-500">{v.content}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
