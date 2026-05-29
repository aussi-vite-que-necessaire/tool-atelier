import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from '@/lib/auth/preview';

// Tremplin vers le SSO central. En preview, loginRedirect auto-connecte user1
// (ou montre le chooser si le marqueur de logout est posé).
export default async function SignInPage() {
  const cookieHeader = (await headers()).get('cookie');
  redirect(
    loginRedirect({
      authUrl: env.AUTH_URL,
      back: env.APP_URL,
      preview: isPreview,
      cookieHeader,
      defaultUser: DEFAULT_PREVIEW_USER,
    }),
  );
}
