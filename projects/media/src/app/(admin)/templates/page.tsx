export const dynamic = "force-dynamic";

import Link from "next/link";
import { listTemplates } from "@/lib/templates/repository";
import { requireUserId } from "@/lib/session";
import { createTemplateAction, deleteTemplateAction } from "./actions";

export default async function TemplatesPage() {
  const userId = await requireUserId();
  const templates = await listTemplates(userId);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Templates visuels</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chaque template est un layout HTML + CSS paramétré par des variables. Cliquez sur un
          template pour l&apos;éditer et lancer un aperçu de rendu.
        </p>
      </div>

      {/* Formulaire de création */}
      <div className="border border-gray-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-medium">Nouveau template</h2>
        <form action={createTemplateAction} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1" htmlFor="new-slug">
                Slug
              </label>
              <input
                id="new-slug"
                name="slug"
                type="text"
                required
                placeholder="ex. post-linkedin"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1" htmlFor="new-label">
                Libellé
              </label>
              <input
                id="new-label"
                name="label"
                type="text"
                required
                placeholder="ex. Post LinkedIn"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600 mb-1" htmlFor="new-width">
                Largeur (px)
              </label>
              <input
                id="new-width"
                name="width"
                type="number"
                required
                defaultValue={1200}
                min={1}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1" htmlFor="new-height">
                Hauteur (px)
              </label>
              <input
                id="new-height"
                name="height"
                type="number"
                required
                defaultValue={630}
                min={1}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="new-body">
              HTML (body)
            </label>
            <textarea
              id="new-body"
              name="body_html"
              rows={3}
              placeholder="<div class='p-8'>...</div>"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700"
          >
            Créer
          </button>
        </form>
      </div>

      {/* Liste des templates existants */}
      {templates.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun template pour l&apos;instant.</p>
      ) : (
        <table className="w-full text-sm border border-gray-200 rounded overflow-hidden">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-600">Libellé</th>
              <th className="px-3 py-2 font-medium text-gray-600">Slug</th>
              <th className="px-3 py-2 font-medium text-gray-600">Dimensions</th>
              <th className="px-3 py-2 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link
                    href={`/templates/${t.id}`}
                    className="font-medium text-gray-800 hover:underline"
                  >
                    {t.label}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono">{t.slug}</td>
                <td className="px-3 py-2 text-gray-500">
                  {t.width}&times;{t.height}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/templates/${t.id}`}
                      className="text-gray-600 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5"
                    >
                      Éditer
                    </Link>
                    <form action={deleteTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-0.5"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
