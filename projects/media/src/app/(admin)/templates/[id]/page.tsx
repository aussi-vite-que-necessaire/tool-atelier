export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates/repository";
import { listGuides } from "@/lib/style-guides/repository";
import { requireUserId } from "@/lib/session";
import { saveTemplateAction } from "../actions";
import { TemplatePreview } from "./template-preview";
import { StyleGuideSelect } from "./style-guide-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Muted } from "@/components/ui/typography";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const template = await getTemplate(userId, id);
  if (!template) notFound();

  const guides = await listGuides(userId);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <Heading level={2}>{template.label}</Heading>
        <Muted>Édite le template puis enregistre avant de lancer l&apos;aperçu.</Muted>
      </div>

      {/* Formulaire d'édition */}
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
            <Input id="width" name="width" type="number" required min={1} defaultValue={template.width} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="height">Hauteur (px)</Label>
            <Input id="height" name="height" type="number" required min={1} defaultValue={template.height} />
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
          <Textarea id="body_html" name="body_html" rows={10} defaultValue={template.bodyHtml} className="font-mono" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="css">CSS</Label>
          <Textarea id="css" name="css" rows={6} defaultValue={template.css} className="font-mono" />
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
          <Label htmlFor="sample_vars">Variables d&apos;exemple (JSON)</Label>
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

      {/* Aperçu de rendu — côté client, déclenché sur bouton uniquement */}
      <div className="border-t border-border pt-6">
        <Heading level={4} className="mb-2">
          Aperçu de rendu
        </Heading>
        <TemplatePreview templateId={template.id} />
      </div>
    </div>
  );
}
