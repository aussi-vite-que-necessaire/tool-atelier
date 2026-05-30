import { notFound } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { getPublicationFormat } from '@/lib/db/repositories/publication-formats';
import { FormatForm } from '../format-form';
import { deletePublicationFormatActionRaw, updatePublicationFormatAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditPublicationFormatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();

  const { id } = await params;
  const format = await getPublicationFormat(userId, id);
  if (!format) notFound();

  const updateAction = updatePublicationFormatAction.bind(null, id);
  const deleteAction = deletePublicationFormatActionRaw.bind(null, id);

  return (
    <SettingsPage title="Éditer le format">
      <SettingsCard>
        <FormatForm
          mode="edit"
          initial={{
            name: format.name,
            platform: format.platform,
            structure: format.structure,
            visualIntent: format.visualIntent,
            writingRules: format.writingRules,
          }}
          action={updateAction}
          successMessage="Format mis à jour"
        />
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
