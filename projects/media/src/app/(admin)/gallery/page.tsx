export const dynamic = "force-dynamic";

import Link from "next/link";
import { listMediaRecords } from "@/lib/media/repository";
import type { MediaKind } from "@/lib/media/types";
import { requireUserId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/typography";
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
    <div className="mx-auto max-w-6xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4">
        <Heading level={2}>
          Galerie{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({items.length} élément{items.length !== 1 ? "s" : ""})
          </span>
        </Heading>
        <Button render={<Link href="/gallery/new" />}>+ Ajouter à la galerie</Button>
      </div>

      {/* Filtres par kind */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!kind ? "default" : "outline"}
          size="sm"
          render={<Link href="/gallery" />}
        >
          Tous
        </Button>
        {KINDS.map((k) => (
          <Button
            key={k}
            variant={kind === k ? "default" : "outline"}
            size="sm"
            render={<Link href={`/gallery?kind=${k}`} />}
          >
            {k}
          </Button>
        ))}
      </div>

      {/* Grille des médias */}
      <GalleryGrid items={items} />
    </div>
  );
}
