import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/cast/settings/formats');
}
