import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { isPreview } from '@/lib/auth/preview';

export default function SignInPage() {
  if (isPreview) {
    // En preview, le auto-login se déclenche via GET /api/preview-login.
    redirect('/api/preview-login?redirect=/');
  }
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`);
}
