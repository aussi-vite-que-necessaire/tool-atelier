import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { FormatForm } from '../format-form';
import { createPublicationFormatAction } from './actions';

export default async function NewPublicationFormatPage() {
  await requireUserId();

  return (
    <SettingsPage title="Nouveau format de publication">
      <SettingsCard>
        <FormatForm
          mode="create"
          action={createPublicationFormatAction}
          successMessage="Format créé"
        />
      </SettingsCard>
    </SettingsPage>
  );
}
