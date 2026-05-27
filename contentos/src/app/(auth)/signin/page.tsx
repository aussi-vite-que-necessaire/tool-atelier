import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPreview } from '@/lib/auth/preview';
import { auth } from '@/lib/auth/server';
import { OtpForm } from './otp-form';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; redirectTo?: string }>;
}) {
  const sp = await searchParams;
  const target = sp.redirect || sp.redirectTo || '/';

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(target);
  if (isPreview) redirect(`/api/preview-login?redirect=${encodeURIComponent(target)}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Reçois un code par email pour te connecter.</CardDescription>
      </CardHeader>
      <CardContent>
        <OtpForm redirectTo={target} />
      </CardContent>
    </Card>
  );
}
