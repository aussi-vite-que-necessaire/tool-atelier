export const dynamic = "force-dynamic";

import { listMediaRecords } from "@/lib/media/repository";
import { listStyles } from "@/lib/styles/repository";
import { requireUserId } from "@/lib/session";
import { AddMediaDialog } from "./add-media-dialog";
import type { PickerImage } from "./composer";
import { resolveTab } from "./tabs";

// Le composer PDF n'embarque que PNG et JPEG : ne proposer que ces formats.
const PDF_MIMES = new Set(["image/png", "image/jpeg"]);

export default async function NewMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await requireUserId();
  const { tab: tabParam } = await searchParams;
  const tab = resolveTab(tabParam);

  const [styles, images, renders] = await Promise.all([
    listStyles(userId),
    listMediaRecords(userId, { kind: "image", limit: 100 }),
    listMediaRecords(userId, { kind: "render", limit: 100 }),
  ]);

  const pickable: PickerImage[] = [...images, ...renders]
    .filter((m) => PDF_MIMES.has(m.mime))
    .sort((a, b) => b.created_at - a.created_at)
    .map((m) => ({ id: m.id, url: m.url }));

  return (
    <AddMediaDialog
      tab={tab}
      styles={styles.map((s) => ({ id: s.id, name: s.name }))}
      images={pickable}
    />
  );
}
