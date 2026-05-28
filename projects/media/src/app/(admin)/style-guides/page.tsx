export const dynamic = "force-dynamic";

import { listGuides } from "@/lib/style-guides/repository";
import {
  createGuideAction,
  updateGuideAction,
  deleteGuideAction,
} from "./actions";

export default async function StyleGuidesPage() {
  const guides = await listGuides();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Chartes graphiques</h1>
        <p className="mt-1 text-sm text-gray-500">
          Référence markdown injectée comme contexte de génération (palette, typographie, ton, etc.).
        </p>
      </div>

      {/* Formulaire de création */}
      <div className="border border-gray-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-medium">Nouvelle charte</h2>
        <form action={createGuideAction} className="space-y-2">
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="new-name">
              Nom
            </label>
            <input
              id="new-name"
              name="name"
              type="text"
              required
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1" htmlFor="new-content">
              Contenu (markdown)
            </label>
            <textarea
              id="new-content"
              name="content"
              required
              rows={6}
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

      {/* Liste des chartes existantes */}
      {guides.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune charte pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-4">
          {guides.map((guide) => (
            <li key={guide.id} className="border border-gray-200 rounded p-4 space-y-3">
              {/* Formulaire d'édition */}
              <form action={updateGuideAction} className="space-y-2">
                <input type="hidden" name="id" value={guide.id} />
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={guide.name}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Contenu (markdown)</label>
                  <textarea
                    name="content"
                    required
                    rows={6}
                    defaultValue={guide.content}
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

              {/* Formulaire de suppression */}
              <form action={deleteGuideAction}>
                <input type="hidden" name="id" value={guide.id} />
                <button
                  type="submit"
                  className="text-sm text-red-600 hover:text-red-800 border border-red-200 rounded px-3 py-1"
                >
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
