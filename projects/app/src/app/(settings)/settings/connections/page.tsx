import { SettingsPage } from '@/components/settings/settings-page';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { runwayDays } from '@/lib/linkedin/runway';
import { DisconnectButton } from './_components/disconnect-button';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const account = await getSocialAccount(userId, 'linkedin');
  const days = account ? runwayDays(account.expiresAt) : 0;

  return (
    <SettingsPage title="Connexions" description="Comptes sociaux pour la publication.">
      {sp.error && (
        <p className="text-sm text-red-600">
          {sp.error === 'state'
            ? 'Échec de la vérification (state). Réessaie.'
            : 'La connexion LinkedIn a échoué. Réessaie.'}
        </p>
      )}
      {sp.connected && <p className="text-sm text-green-700">Compte LinkedIn connecté.</p>}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">LinkedIn</p>
            {account ? (
              <p className="text-xs text-neutral-500">
                {account.displayName} ·{' '}
                <span className={days <= 7 ? 'text-red-600' : ''}>
                  expire dans {days} jour{days > 1 ? 's' : ''}
                </span>
              </p>
            ) : (
              <p className="text-xs text-neutral-500">Non connecté</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/linkedin/connect"
              className={buttonVariants({ variant: account ? 'outline' : 'default', size: 'sm' })}
            >
              {account ? 'Reconnecter' : 'Connecter LinkedIn'}
            </a>
            {account && <DisconnectButton />}
          </div>
        </div>
      </Card>
    </SettingsPage>
  );
}
