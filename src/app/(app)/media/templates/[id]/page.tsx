import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heading, Muted } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { listGuides } from '@/lib/media/style-guides';
import { getTemplate } from '@/lib/media/templates/repository';
import { cn } from '@/lib/utils';
import { saveTemplateAction } from '../actions';
import { StyleGuideSelect } from './style-guide-select';
import { TemplatePreview } from './template-preview';

export const dynamic = 'force-dynamic';

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const template = await getTemplate(userId, id);
  if (!template) notFound();

  const guides = await listGuides(userId);

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href="/media/templates"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
      >
        <ArrowLeft className="h-4 w-4" />
        Tous les templates
      </Link>

      <div className="space-y-1">
        <Heading level={1}>{template.label}</Heading>
        <Muted>Édite le template puis enregistre avant de lancer l'aperçu.</Muted>
      </div>

      <form action={saveTemplateAction} className="space-y-4">
        <input type="hidden" name="id" value={template.id} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" name="slug" type="text" required defaultValue={template.slug} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label">Libellé</Label>
            <Input id="label" name="label" type="text" required defaultValue={template.label} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="platform">Plateforme</Label>
            <Input id="platform" name="platform" type="text" defaultValue={template.platform} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="width">Largeur (px)</Label>
            <Input
              id="width"
              name="width"
              type="number"
              required
              min={1}
              defaultValue={template.width}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="height">Hauteur (px)</Label>
            <Input
              id="height"
              name="height"
              type="number"
              required
              min={1}
              defaultValue={template.height}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Charte graphique</Label>
          <StyleGuideSelect
            guides={guides.map((g) => ({ id: g.id, name: g.name }))}
            defaultId={template.styleGuideId ?? null}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body_html">HTML (body)</Label>
          <Textarea
            id="body_html"
            name="body_html"
            rows={10}
            defaultValue={template.bodyHtml}
            className="font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="css">CSS</Label>
          <Textarea
            id="css"
            name="css"
            rows={6}
            defaultValue={template.css}
            className="font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variables_schema">Schéma de variables (JSON)</Label>
          <Textarea
            id="variables_schema"
            name="variables_schema"
            rows={6}
            defaultValue={JSON.stringify(template.variablesSchema, null, 2)}
            className="font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sample_vars">Variables d'exemple (JSON)</Label>
          <Textarea
            id="sample_vars"
            name="sample_vars"
            rows={6}
            defaultValue={JSON.stringify(template.sampleVars, null, 2)}
            className="font-mono"
          />
        </div>

        <Button type="submit">Enregistrer</Button>
      </form>

      <div className="border-border border-t pt-6">
        <Heading level={3} className="mb-2">
          Aperçu de rendu
        </Heading>
        <TemplatePreview templateId={template.id} />
      </div>
    </div>
  );
}
