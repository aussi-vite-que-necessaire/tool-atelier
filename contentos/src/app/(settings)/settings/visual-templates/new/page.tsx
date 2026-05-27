import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { VisualTemplateForm } from '../visual-template-form';
import { createVisualTemplateAction } from './actions';

export default async function NewVisualTemplatePage() {
  await requireUserId();
  return (
    <SettingsPage title="Nouveau template visuel">
      <VisualTemplateForm
        mode="create"
        action={createVisualTemplateAction}
        successMessage="Template créé"
      />
    </SettingsPage>
  );
}
