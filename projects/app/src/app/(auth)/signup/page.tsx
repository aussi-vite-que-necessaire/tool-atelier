import { SignUpForm } from './sign-up-form';

// Inscription self-serve (auth in-app). Un nouveau compte reçoit le rôle
// `operator` par défaut (cf. lib/auth.ts) et est connecté dans la foulée.
export default function SignUpPage() {
  return <SignUpForm />;
}
