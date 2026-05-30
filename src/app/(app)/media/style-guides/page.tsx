import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heading, Muted } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { listGuides } from '@/lib/media/style-guides';
import { createGuideAction, deleteGuideAction, updateGuideAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chartes — Media' };

export default async function StyleGuidesPage() {
  const userId = await requireUserId();
  const guides = await listGuides(userId);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <Heading level={1}>Chartes graphiques</Heading>
        <Muted>
          Une charte documente palette, typographie et conventions visuelles (markdown). Un template
          peut s'y rattacher pour garder la cohérence de marque.
        </Muted>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle charte</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGuideAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nom</Label>
              <Input id="new-name" name="name" type="text" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-content">Contenu (markdown)</Label>
              <Textarea
                id="new-content"
                name="content"
                rows={5}
                placeholder="## Palette&#10;- Primaire #1a1a1a&#10;## Typographie&#10;…"
              />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>

      {guides.length === 0 ? (
        <Muted>Aucune charte pour l'instant.</Muted>
      ) : (
        <div className="space-y-4">
          {guides.map((guide) => (
            <Card key={guide.id}>
              <CardContent className="space-y-3 pt-5">
                <form action={updateGuideAction} className="space-y-3">
                  <input type="hidden" name="id" value={guide.id} />
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="name" type="text" required defaultValue={guide.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contenu (markdown)</Label>
                    <Textarea name="content" rows={6} defaultValue={guide.content} />
                  </div>
                  <Button type="submit">Enregistrer</Button>
                </form>
                <form action={deleteGuideAction}>
                  <input type="hidden" name="id" value={guide.id} />
                  <Button variant="destructive" size="sm" type="submit">
                    Supprimer
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
