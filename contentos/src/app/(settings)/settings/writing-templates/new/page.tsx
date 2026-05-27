import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { WritingTemplateForm } from '../writing-template-form';
import { createWritingTemplateAction } from './actions';

export default async function NewWritingTemplatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <SettingsPage title="Nouveau template d'écriture">
      <SettingsCard>
        <WritingTemplateForm
          mode="create"
          action={createWritingTemplateAction}
          successMessage="Template créé"
        />
      </SettingsCard>
    </SettingsPage>
  );
}
