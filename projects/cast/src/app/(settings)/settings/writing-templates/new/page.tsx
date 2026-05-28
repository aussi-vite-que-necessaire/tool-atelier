import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { WritingTemplateForm } from '../writing-template-form';
import { createWritingTemplateAction } from './actions';

export default async function NewWritingTemplatePage() {
  await requireUserId();

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
