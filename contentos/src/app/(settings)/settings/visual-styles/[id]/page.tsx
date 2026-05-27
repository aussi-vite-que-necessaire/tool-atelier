import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { getVisualStyle } from '@/lib/db/repositories/visual-styles';
import { VisualStyleForm } from '../visual-style-form';
import { deleteVisualStyleActionRaw, updateVisualStyleAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditVisualStylePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const style = await getVisualStyle(session.user.id, id);
  if (!style) notFound();

  const updateAction = updateVisualStyleAction.bind(null, id);
  const deleteAction = deleteVisualStyleActionRaw.bind(null, id);

  return (
    <SettingsPage title="Éditer le style">
      <SettingsCard>
        <VisualStyleForm
          mode="edit"
          initial={{ name: style.name, prompt: style.prompt }}
          action={updateAction}
          successMessage="Style mis à jour"
        />
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
