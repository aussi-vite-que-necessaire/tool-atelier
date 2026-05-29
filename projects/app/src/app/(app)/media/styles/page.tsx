import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heading, Muted } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { listStyles } from '@/lib/media/styles';
import { createStyleAction, deleteStyleAction, updateStyleAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Styles — Media' };

export default async function StylesPage() {
  const userId = await requireUserId();
  const styles = await listStyles(userId);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <Heading level={1}>Styles visuels</Heading>
        <Muted>
          Un style est un suffixe ajouté au prompt de génération (ex. « rendu 3D », « flat 2D »).
        </Muted>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau style</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createStyleAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nom</Label>
              <Input id="new-name" name="name" type="text" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-prompt">Prompt</Label>
              <Textarea id="new-prompt" name="prompt" required rows={3} />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>

      {styles.length === 0 ? (
        <Muted>Aucun style pour l'instant.</Muted>
      ) : (
        <div className="space-y-4">
          {styles.map((style) => (
            <Card key={style.id}>
              <CardContent className="space-y-3 pt-5">
                <form action={updateStyleAction} className="space-y-3">
                  <input type="hidden" name="id" value={style.id} />
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="name" type="text" required defaultValue={style.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prompt</Label>
                    <Textarea name="prompt" required rows={3} defaultValue={style.prompt} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Enregistrer</Button>
                  </div>
                </form>
                <form action={deleteStyleAction}>
                  <input type="hidden" name="id" value={style.id} />
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
