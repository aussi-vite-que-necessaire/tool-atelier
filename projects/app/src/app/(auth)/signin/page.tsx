import { isPreview } from '@/lib/auth/preview';
import { SignInForm } from './sign-in-form';

// Page de connexion locale (auth in-app). En preview, expose aussi des boutons
// de connexion rapide vers /preview-login (opérateurs de test seedés).
export default function SignInPage() {
  return <SignInForm preview={isPreview} />;
}
