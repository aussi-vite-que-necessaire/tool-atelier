import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { getSettings } from '@/lib/db/repositories/settings';
import { BrandForm } from './brand-form';

export default async function BrandPage() {
  const userId = await requireUserId();

  const settings = await getSettings(userId);
  if (!settings) {
    throw new Error('settings row missing for authenticated user');
  }

  return (
    <SettingsPage
      title="Identité de marque"
      description="Ces valeurs servent de défauts aux templates et signatures."
    >
      <SettingsCard>
        <BrandForm
          initialValues={{
            brandName: settings.brandName,
            brandSignature: settings.brandSignature,
          }}
        />
      </SettingsCard>
    </SettingsPage>
  );
}
