import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { VisualStyleForm } from '../visual-style-form';
import { createVisualStyleAction } from './actions';

export default async function NewVisualStylePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <SettingsPage title="Nouveau style visuel">
      <SettingsCard>
        <VisualStyleForm
          mode="create"
          action={createVisualStyleAction}
          successMessage="Style créé"
        />
      </SettingsCard>
    </SettingsPage>
  );
}
