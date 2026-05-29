export const dynamic = "force-dynamic";

import { listGuides } from "@/lib/style-guides/repository";
import { requireUserId } from "@/lib/session";
import {
  createGuideAction,
  updateGuideAction,
  deleteGuideAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Muted } from "@/components/ui/typography";

export default async function StyleGuidesPage() {
  const userId = await requireUserId();
  const guides = await listGuides(userId);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <Heading level={2}>Chartes graphiques</Heading>
        <Muted>
          Référence markdown injectée comme contexte de génération (palette, typographie, ton, etc.).
        </Muted>
      </div>

      {/* Formulaire de création */}
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
              <Textarea id="new-content" name="content" required rows={6} className="font-mono" />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>

      {/* Liste des chartes existantes */}
      {guides.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune charte pour l&apos;instant.</p>
      ) : (
        <div className="space-y-4">
          {guides.map((guide) => (
            <Card key={guide.id}>
              <CardContent className="space-y-3">
                {/* Formulaire d'édition */}
                <form action={updateGuideAction} className="space-y-3">
                  <input type="hidden" name="id" value={guide.id} />
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="name" type="text" required defaultValue={guide.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contenu (markdown)</Label>
                    <Textarea name="content" required rows={6} defaultValue={guide.content} className="font-mono" />
                  </div>
                  <Button type="submit">Enregistrer</Button>
                </form>

                {/* Formulaire de suppression */}
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
