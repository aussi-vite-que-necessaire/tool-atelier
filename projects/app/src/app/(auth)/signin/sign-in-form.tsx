'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeRedirect } from '@/lib/auth/redirect';
import { signIn } from '@/lib/auth-client';

export function SignInForm({ preview }: { preview: boolean }) {
  return (
    <Suspense fallback={null}>
      <SignInFormInner preview={preview} />
    </Suspense>
  );
}

function SignInFormInner({ preview }: { preview: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const rq = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';

  // Sur le chooser en preview : pose le marqueur → plus d'auto-login tant qu'il
  // est là (l'opérateur a choisi de gérer sa connexion à la main).
  useEffect(() => {
    if (preview) {
      document.cookie = 'cos_preview_login=manual; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
    }
  }, [preview]);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setPending(true);
    const r = await signIn.email({ email, password });
    setPending(false);
    if (r.error) {
      setError(r.error.message ?? 'Identifiants invalides.');
      return;
    }
    window.location.href = safeRedirect(redirectParam);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">Se connecter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {preview && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
              Connexion rapide (preview)
            </p>
            <Button
              nativeButton={false}
              render={<Link href={`/preview-login?user=1${rq}`} prefetch={false} />}
              className="w-full"
            >
              Entrer comme Opérateur 1
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={`/preview-login?user=2${rq}`} prefetch={false} />}
              variant="outline"
              className="w-full"
            >
              Entrer comme Opérateur 2
            </Button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={pending || !email || !password} className="w-full">
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link
            href={
              redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : '/signup'
            }
            className="underline underline-offset-4 hover:text-foreground"
          >
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
