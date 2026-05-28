import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { WritingTemplateForm } from '../writing-template-form';
import { deleteWritingTemplateActionRaw, updateWritingTemplateAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditWritingTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const template = await getWritingTemplate(session.user.id, id);
  if (!template) notFound();

  const updateAction = updateWritingTemplateAction.bind(null, id);
  const deleteAction = deleteWritingTemplateActionRaw.bind(null, id);

  return (
    <SettingsPage title="Éditer le template">
      <SettingsCard>
        <WritingTemplateForm
          mode="edit"
          initial={{
            name: template.name,
            platform: template.platform,
            structure: template.structure,
            writingRules: template.writingRules,
          }}
          action={updateAction}
          successMessage="Template mis à jour"
        />
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
