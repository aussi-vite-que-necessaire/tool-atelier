import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Code, Heading, Muted } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { getBrand } from '@/lib/media/brand';
import { saveBrandAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marque — Media' };

export default async function BrandPage() {
  const userId = await requireUserId();
  const brand = await getBrand(userId);

  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-1">
        <Heading level={1}>Marque</Heading>
        <Muted>
          Injectée dans les templates via <Code>{'{{brand.name}}'}</Code>,{' '}
          <Code>{'{{brand.signature}}'}</Code>, <Code>{'{{brand.logo}}'}</Code>.
        </Muted>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form action={saveBrandAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Nom</Label>
              <Input id="brand-name" name="name" type="text" defaultValue={brand?.name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-signature">Signature</Label>
              <Textarea
                id="brand-signature"
                name="signature"
                rows={3}
                defaultValue={brand?.signature ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand-logo">URL du logo</Label>
              <Input
                id="brand-logo"
                name="logoUrl"
                type="url"
                defaultValue={brand?.logoUrl ?? ''}
                placeholder="https://…"
              />
            </div>
            <Button type="submit">Enregistrer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
