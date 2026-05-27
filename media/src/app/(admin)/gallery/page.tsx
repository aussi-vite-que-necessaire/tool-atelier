export const dynamic = "force-dynamic";

import Link from "next/link";
import { listMediaRecords } from "@/lib/media/repository";
import type { MediaKind } from "@/lib/media/types";
import { uploadAction, deleteMediaAction } from "./actions";

const KINDS: MediaKind[] = ["image", "video", "pdf", "render"];

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind: kindParam } = await searchParams;
  const kind: MediaKind | undefined = KINDS.includes(kindParam as MediaKind)
    ? (kindParam as MediaKind)
    : undefined;

  const items = await listMediaRecords({ kind, limit: 100 });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold">
          Galerie{" "}
          <span className="text-sm font-normal text-gray-500">
            ({items.length} élément{items.length !== 1 ? "s" : ""})
          </span>
        </h1>
      </div>

      {/* Filtres par kind */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/gallery"
          className={`rounded px-3 py-1 text-sm border ${
            !kind
              ? "bg-gray-800 text-white border-gray-800"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Tous
        </Link>
        {KINDS.map((k) => (
          <Link
            key={k}
            href={`/gallery?kind=${k}`}
            className={`rounded px-3 py-1 text-sm border ${
              kind === k
                ? "bg-gray-800 text-white border-gray-800"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {k}
          </Link>
        ))}
      </div>

      {/* Formulaire d'upload */}
      <div className="border border-gray-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-medium">Uploader un fichier</h2>
        <form action={uploadAction} className="space-y-2">
          <div>
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
              required
              className="block text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>
          <p className="text-xs text-gray-400">
            Types acceptés : PNG, JPEG, WebP (≤ 10 Mo), PDF (≤ 100 Mo), MP4 (≤ 100 Mo via l&apos;UI).
            Pour les vidéos jusqu&apos;à 500 Mo, utiliser l&apos;API <code>/v1/upload</code>.
          </p>
          <button
            type="submit"
            className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700"
          >
            Uploader
          </button>
        </form>
      </div>

      {/* Grille des médias */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun média pour l&apos;instant.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded overflow-hidden flex flex-col"
            >
              {/* Aperçu */}
              <div className="bg-gray-50 flex items-center justify-center h-40 overflow-hidden">
                {(item.kind === "image" || item.kind === "render") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.prompt ?? item.id}
                    className="w-full h-full object-contain"
                  />
                )}
                {item.kind === "video" && (
                  <video
                    src={item.url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
                {item.kind === "pdf" && (
                  <div className="flex flex-col items-center gap-1 p-2 text-center">
                    <span className="text-3xl">📄</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ouvrir le PDF
                    </a>
                  </div>
                )}
              </div>

              {/* Métadonnées + suppression */}
              <div className="p-2 space-y-1 flex flex-col flex-1">
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>
                    <span className="font-medium text-gray-700">{item.kind}</span>
                  </div>
                  {item.width && item.height && (
                    <div>
                      {item.width}&times;{item.height}
                    </div>
                  )}
                  <div className="font-mono text-gray-400 truncate" title={item.id}>
                    {item.id}
                  </div>
                </div>
                <div className="mt-auto pt-1">
                  <form action={deleteMediaAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-0.5"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
