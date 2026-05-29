import { headers } from 'next/headers';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading, Lead, Muted, Text } from '@/components/ui/typography';
import { getSession, signInUrl } from '@/lib/auth';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

const productions = [
  { title: 'Posts', body: 'Rédaction de posts dans ta voix, prêts à relire et publier.' },
  { title: 'Images', body: 'Génération et édition de visuels pour accompagner le texte.' },
  { title: 'Carrousels', body: 'Séquences multi-slides cohérentes, pensées pour le scroll.' },
  { title: 'Vidéos', body: 'Formats courts générés à partir de ton contenu.' },
];

export default async function Home() {
  const session = await getSession(await headers());
  const ctaHref = session ? '/dashboard' : signInUrl();
  const ctaLabel = session ? 'Ouvrir le dashboard' : 'Se connecter';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-16 px-6 py-16">
        {/* Hero */}
        <section className="space-y-4">
          <Heading level={1} className="text-4xl">
            Produire du contenu social, piloté par des agents IA.
          </Heading>
          <Lead className="max-w-2xl">
            contentos est une suite d'outils pensés pour être pilotés par des agents IA —
            Claude, GPT, Gemini — afin de produire, planifier et publier du contenu pour les
            réseaux sociaux.
          </Lead>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button render={<a href={ctaHref} />}>{ctaLabel}</Button>
            <Muted>Projet exploratoire — accès sur connexion.</Muted>
          </div>
        </section>

        {/* Pitch */}
        <section className="space-y-3">
          <Heading level={2}>L'idée</Heading>
          <Text className="max-w-2xl">
            Faciliter la production de contenu pour les réseaux sociaux en s'appuyant sur l'IA,
            sans perdre la main : un atelier où des agents font le gros du travail et où l'humain
            garde le dernier mot.
          </Text>
        </section>

        {/* Ce qu'on produit */}
        <section className="space-y-6">
          <Heading level={2}>Ce qu'on produit</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            {productions.map((p) => (
              <Card key={p.title}>
                <CardHeader>
                  <CardTitle>{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="text-muted-foreground">{p.body}</Text>
                </CardContent>
              </Card>
            ))}
          </div>
          <Muted>Et la publication automatisée — planifiée, au bon moment.</Muted>
        </section>

        {/* Valeur cardinale */}
        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-6">
          <Heading level={2}>La valeur cardinale</Heading>
          <Lead className="max-w-2xl text-foreground">
            Garder le contrôle sur le pipe de production et augmenter la qualité de ce qui est
            livré.
          </Lead>
          <Text className="max-w-2xl text-muted-foreground">
            L'IA accélère et démultiplie ; l'humain cadre, arbitre et valide. Chaque étape reste
            inspectable et reprenable.
          </Text>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
