export const dynamic = "force-dynamic";

import { listMediaRecords } from "@/lib/media/repository";
import { listStyles } from "@/lib/styles/repository";
import { listTemplates } from "@/lib/templates/repository";
import { requireUserId } from "@/lib/session";
import { AddMediaDialog } from "./add-media-dialog";
import type { PickerImage } from "./composer";
import type { TemplateOption } from "./template-tab";
import type { FormImage } from "./template-vars-form";
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

  const [styles, images, renders, templates] = await Promise.all([
    listStyles(userId),
    listMediaRecords(userId, { kind: "image", limit: 100 }),
    listMediaRecords(userId, { kind: "render", limit: 100 }),
    listTemplates(userId),
  ]);

  const sorted = [...images, ...renders].sort(
    (a, b) => b.created_at - a.created_at,
  );

  const pickable: PickerImage[] = sorted
    .filter((m) => PDF_MIMES.has(m.mime))
    .map((m) => ({ id: m.id, url: m.url }));

  // Images sélectionnables comme variable `image` d'un template : on accepte
  // tout média image/render affichable (la valeur injectée est l'URL).
  const templateImages: FormImage[] = sorted.map((m) => ({
    id: m.id,
    url: m.url,
  }));

  const templateOptions: TemplateOption[] = templates.map((t) => ({
    id: t.id,
    label: t.label,
    platform: t.platform,
    width: t.width,
    height: t.height,
    variablesSchema: t.variablesSchema,
    sampleVars: t.sampleVars,
  }));

  return (
    <AddMediaDialog
      tab={tab}
      styles={styles.map((s) => ({ id: s.id, name: s.name }))}
      images={pickable}
      templates={templateOptions}
      templateImages={templateImages}
    />
  );
}
