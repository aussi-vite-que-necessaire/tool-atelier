export const dynamic = "force-dynamic";

import { listStyles } from "@/lib/styles/repository";
import { requireUserId } from "@/lib/session";
import {
  createStyleAction,
  updateStyleAction,
  deleteStyleAction,
} from "./actions";

export default async function StylesPage() {
  const userId = await requireUserId();
  const styles = await listStyles(userId);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Styles visuels</h1>
        <p className="mt-1 text-sm text-gray-500">
          Un style est un suffixe ajouté au prompt de génération (ex. « rendu 3D », « flat 2D »).
        </p>
      </div>

      {/* Formulaire de création */}
      <div className="border border-gray-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-medium">Nouveau style</h2>
        <form action={createStyleAction} className="space-y-2">
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
            <label className="block text-sm text-gray-600 mb-1" htmlFor="new-prompt">
              Prompt
            </label>
            <textarea
              id="new-prompt"
              name="prompt"
              required
              rows={3}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
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

      {/* Liste des styles existants */}
      {styles.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun style pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-4">
          {styles.map((style) => (
            <li key={style.id} className="border border-gray-200 rounded p-4 space-y-3">
              {/* Formulaire d'édition */}
              <form action={updateStyleAction} className="space-y-2">
                <input type="hidden" name="id" value={style.id} />
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom</label>
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={style.name}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Prompt</label>
                  <textarea
                    name="prompt"
                    required
                    rows={3}
                    defaultValue={style.prompt}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
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
              <form action={deleteStyleAction}>
                <input type="hidden" name="id" value={style.id} />
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
