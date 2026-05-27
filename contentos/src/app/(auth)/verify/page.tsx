import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérifie ta boîte mail</CardTitle>
        <CardDescription>
          {email
            ? `Un lien de connexion a été envoyé à ${email}.`
            : "Un lien de connexion vient d'être envoyé."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600">
          Pense à regarder dans tes spams. Le lien expire dans 10 minutes.
        </p>
      </CardContent>
    </Card>
  );
}
