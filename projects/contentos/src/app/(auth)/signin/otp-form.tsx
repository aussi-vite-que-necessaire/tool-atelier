'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/client';

export function OtpForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setLoading(false);
    if (error) setError('Envoi impossible. Réessaie.');
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    setLoading(false);
    if (error) {
      setError('Code invalide ou expiré.');
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !email} className="w-full">
          {loading ? 'Envoi...' : 'Recevoir mon code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-neutral-600">
        Code envoyé à <span className="font-medium text-neutral-900">{email}</span>.
      </p>
      <div className="space-y-2">
        <Label htmlFor="code">Code à 6 chiffres</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          disabled={loading}
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || code.length < 6} className="w-full">
        {loading ? 'Vérification...' : 'Se connecter'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setStep('email');
          setError(null);
          setCode('');
        }}
      >
        Changer d'email
      </Button>
    </form>
  );
}
