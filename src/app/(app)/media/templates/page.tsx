import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heading, Muted } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { listTemplates } from '@/lib/media/templates/repository';
import { createTemplateAction, deleteTemplateAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Templates — Media' };

export default async function TemplatesPage() {
  const userId = await requireUserId();
  const templates = await listTemplates(userId);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <Heading level={1}>Templates visuels</Heading>
        <Muted>
          Chaque template est un layout HTML + CSS (Handlebars) paramétré par des variables. Ouvre
          un template pour l'éditer et lancer un aperçu de rendu.
        </Muted>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau template</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTemplateAction} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-slug">Slug</Label>
                <Input
                  id="new-slug"
                  name="slug"
                  type="text"
                  required
                  placeholder="ex. post-linkedin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-label">Libellé</Label>
                <Input
                  id="new-label"
                  name="label"
                  type="text"
                  required
                  placeholder="ex. Post LinkedIn"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-width">Largeur (px)</Label>
                <Input
                  id="new-width"
                  name="width"
                  type="number"
                  required
                  defaultValue={1200}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-height">Hauteur (px)</Label>
                <Input
                  id="new-height"
                  name="height"
                  type="number"
                  required
                  defaultValue={630}
                  min={1}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-body">HTML (body)</Label>
              <Textarea
                id="new-body"
                name="body_html"
                rows={3}
                placeholder="<div class='p-8'>…</div>"
                className="font-mono"
              />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>

      {templates.length === 0 ? (
        <Muted>Aucun template pour l'instant.</Muted>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Libellé</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Dimensions</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link href={`/media/templates/${t.id}`} className="font-medium hover:underline">
                      {t.label}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{t.slug}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.width}&times;{t.height}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        render={<Link href={`/media/templates/${t.id}`} />}
                      >
                        Éditer
                      </Button>
                      <form action={deleteTemplateAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <Button variant="destructive" size="xs" type="submit">
                          Supprimer
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
