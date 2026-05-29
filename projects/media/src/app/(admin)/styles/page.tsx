export const dynamic = "force-dynamic";

import { listStyles } from "@/lib/styles/repository";
import { requireUserId } from "@/lib/session";
import {
  createStyleAction,
  updateStyleAction,
  deleteStyleAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Muted } from "@/components/ui/typography";

export default async function StylesPage() {
  const userId = await requireUserId();
  const styles = await listStyles(userId);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <Heading level={2}>Styles visuels</Heading>
        <Muted>
          Un style est un suffixe ajouté au prompt de génération (ex. « rendu 3D », « flat 2D »).
        </Muted>
      </div>

      {/* Formulaire de création */}
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

      {/* Liste des styles existants */}
      {styles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun style pour l&apos;instant.</p>
      ) : (
        <div className="space-y-4">
          {styles.map((style) => (
            <Card key={style.id}>
              <CardContent className="space-y-3">
                {/* Formulaire d'édition */}
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
                  <Button type="submit">Enregistrer</Button>
                </form>

                {/* Formulaire de suppression */}
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
