export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates/repository";
import { listGuides } from "@/lib/style-guides/repository";
import { saveTemplateAction } from "../actions";
import { TemplatePreview } from "./template-preview";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();

  const guides = await listGuides();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{template.label}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Édite le template puis enregistre avant de lancer l&apos;aperçu.
        </p>
      </div>

      {/* Formulaire d'édition */}
      <form action={saveTemplateAction} className="space-y-4">
        <input type="hidden" name="id" value={template.id} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              defaultValue={template.slug}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="label">
              Libellé
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              defaultValue={template.label}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="platform">
              Plateforme
            </label>
            <input
              id="platform"
              name="platform"
              type="text"
              defaultValue={template.platform}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="width">
              Largeur (px)
            </label>
            <input
              id="width"
              name="width"
              type="number"
              required
              min={1}
              defaultValue={template.width}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="height">
              Hauteur (px)
            </label>
            <input
              id="height"
              name="height"
              type="number"
              required
              min={1}
              defaultValue={template.height}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="style_guide_id">
            Charte graphique
          </label>
          <select
            id="style_guide_id"
            name="style_guide_id"
            defaultValue={template.styleGuideId ?? ""}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">— Aucune —</option>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="body_html">
            HTML (body)
          </label>
          <textarea
            id="body_html"
            name="body_html"
            rows={10}
            defaultValue={template.bodyHtml}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="css">
            CSS
          </label>
          <textarea
            id="css"
            name="css"
            rows={6}
            defaultValue={template.css}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="variables_schema">
            Schéma de variables (JSON)
          </label>
          <textarea
            id="variables_schema"
            name="variables_schema"
            rows={6}
            defaultValue={JSON.stringify(template.variablesSchema, null, 2)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="sample_vars">
            Variables d&apos;exemple (JSON)
          </label>
          <textarea
            id="sample_vars"
            name="sample_vars"
            rows={6}
            defaultValue={JSON.stringify(template.sampleVars, null, 2)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
          />
        </div>

        <button
          type="submit"
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700"
        >
          Enregistrer
        </button>
      </form>

      {/* Aperçu de rendu — côté client, déclenché sur bouton uniquement */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-medium mb-2">Aperçu de rendu</h2>
        <TemplatePreview templateId={template.id} />
      </div>
    </div>
  );
}
