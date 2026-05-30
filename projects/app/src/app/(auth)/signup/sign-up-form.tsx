'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeRedirect } from '@/lib/auth/redirect';
import { signUp } from '@/lib/auth-client';

const MIN_PASSWORD = 8;

export function SignUpForm() {
  return (
    <Suspense fallback={null}>
      <SignUpFormInner />
    </Suspense>
  );
}

function SignUpFormInner() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const signinHref = redirectParam
    ? `/signin?redirect=${encodeURIComponent(redirectParam)}`
    : '/signin';

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    setPending(true);
    // autoSignIn (cf. lib/auth.ts) ouvre la session dans la foulée de la création.
    const r = await signUp.email({ name, email, password });
    setPending(false);
    if (r.error) {
      setError(r.error.message ?? 'Impossible de créer le compte.');
      return;
    }
    window.location.href = safeRedirect(redirectParam);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-xl">Créer un compte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Au moins {MIN_PASSWORD} caractères.</p>
          </div>
          <Button
            type="submit"
            disabled={pending || !name || !email || !password}
            className="w-full"
          >
            {pending ? 'Création…' : 'Créer mon compte'}
          </Button>
        </form>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href={signinHref} className="underline underline-offset-4 hover:text-foreground">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
