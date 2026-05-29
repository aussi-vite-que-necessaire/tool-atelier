import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRightIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading, Lead } from '@/components/ui/typography';
import { getSession, signInUrl } from '@/lib/auth';
import { tools } from '@/lib/tools';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export default async function Dashboard() {
  const session = await getSession(await headers());
  // Gate SSO : en prod, pas de session → on renvoie vers le provider. Hors-prod,
  // getSession court-circuite (identité de preview) et on passe.
  if (!session) redirect(signInUrl());

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
        <div className="space-y-2">
          <Heading level={1}>Dashboard</Heading>
          <Lead>Les outils de la suite contentos.</Lead>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <a
              key={tool.name}
              href={tool.url}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:border-foreground/30 hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tool.label}
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription>{tool.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="font-mono text-xs text-muted-foreground">
                  {tool.url.replace('https://', '')}
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
