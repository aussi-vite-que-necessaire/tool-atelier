import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { getSettings } from '@/lib/db/repositories/settings';
import { BrandForm } from './brand-form';
import { LogoField } from './logo-field';

export default async function BrandPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const settings = await getSettings(session.user.id);
  if (!settings) {
    throw new Error('settings row missing for authenticated user');
  }

  return (
    <SettingsPage
      title="Identité de marque"
      description="Ces valeurs servent de défauts aux templates et signatures."
    >
      <SettingsCard>
        <div className="space-y-6">
          <BrandForm
            initialValues={{
              brandName: settings.brandName,
              brandSignature: settings.brandSignature,
            }}
          />
          <LogoField initialLogoUrl={settings.brandLogoUrl} />
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
