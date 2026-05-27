export const dynamic = "force-dynamic";

import Link from "next/link";
import { listMediaRecords } from "@/lib/media/repository";
import { listStyles } from "@/lib/styles/repository";
import type { MediaKind } from "@/lib/media/types";
import { uploadAction } from "./actions";
import { GenerateForm } from "./generate-form";
import { GalleryGrid } from "./gallery-grid";

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

  const [items, styles] = await Promise.all([
    listMediaRecords({ kind, limit: 100 }),
    listStyles(),
  ]);

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

      {/* Ajout : upload manuel | génération IA */}
      <div className="grid gap-4 md:grid-cols-2">
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

        <GenerateForm styles={styles.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      {/* Grille des médias */}
      <GalleryGrid items={items} />
    </div>
  );
}
