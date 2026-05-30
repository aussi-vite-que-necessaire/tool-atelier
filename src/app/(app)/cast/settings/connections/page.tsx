import { redirect } from 'next/navigation';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';

// Les connexions sociales ont migré vers l'espace Compte (niveau suite).
export default function LegacyConnectionsPage() {
  redirect(ACCOUNT_CONNECTIONS_PATH);
}
