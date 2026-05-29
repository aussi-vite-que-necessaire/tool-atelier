export const dynamic = "force-dynamic";

import Link from "next/link";
import { listMediaRecords } from "@/lib/media/repository";
import type { MediaKind } from "@/lib/media/types";
import { requireUserId } from "@/lib/session";
import { GalleryGrid } from "./gallery-grid";

const KINDS: MediaKind[] = ["image", "video", "pdf", "render"];

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const userId = await requireUserId();
  const { kind: kindParam } = await searchParams;
  const kind: MediaKind | undefined = KINDS.includes(kindParam as MediaKind)
    ? (kindParam as MediaKind)
    : undefined;

  const items = await listMediaRecords(userId, { kind, limit: 100 });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          Galerie{" "}
          <span className="text-sm font-normal text-gray-500">
            ({items.length} élément{items.length !== 1 ? "s" : ""})
          </span>
        </h1>
        <Link
          href="/gallery/new"
          className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          + Ajouter à la galerie
        </Link>
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

      {/* Grille des médias */}
      <GalleryGrid items={items} />
    </div>
  );
}
