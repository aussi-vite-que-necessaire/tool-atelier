import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { StyleGuideForm } from '../style-guide-form';
import { createStyleGuideAction } from './actions';

export default async function NewStyleGuidePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <SettingsPage title="Nouveau style guide">
      <SettingsCard>
        <StyleGuideForm
          mode="create"
          action={createStyleGuideAction}
          successMessage="Style guide créé"
        />
      </SettingsCard>
    </SettingsPage>
  );
}
