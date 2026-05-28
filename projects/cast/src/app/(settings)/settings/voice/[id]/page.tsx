import { notFound } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { requireUserId } from '@/lib/auth/session';
import { getVoice } from '@/lib/db/repositories/voice';
import { VoiceForm } from '../voice-form';
import { deleteVoiceAction, updateVoiceAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditVoicePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const voice = await getVoice(userId, id);
  if (!voice) notFound();

  const updateAction = updateVoiceAction.bind(null, id);
  const deleteAction = deleteVoiceAction.bind(null, id);

  return (
    <SettingsPage title="Éditer la voix">
      <SettingsCard>
        <VoiceForm
          mode="edit"
          initial={{ name: voice.name, content: voice.content }}
          action={updateAction}
          successMessage="Voix mise à jour"
        />
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
