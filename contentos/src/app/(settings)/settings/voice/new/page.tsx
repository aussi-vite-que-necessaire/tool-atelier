import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { VoiceForm } from '../voice-form';
import { createVoiceAction } from './actions';

export default function NewVoicePage() {
  return (
    <SettingsPage title="Nouvelle voix">
      <SettingsCard>
        <VoiceForm mode="create" action={createVoiceAction} successMessage="Voix créée" />
      </SettingsCard>
    </SettingsPage>
  );
}
