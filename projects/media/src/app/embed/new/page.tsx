export const dynamic = "force-dynamic";

import { listMediaRecords } from "@/lib/media/repository";
import { listStyles } from "@/lib/styles/repository";
import { listTemplates } from "@/lib/templates/repository";
import { requireUserId } from "@/lib/session";
import { isAllowedParentOrigin } from "@/lib/embed/origin";
import { resolveTab } from "@/app/(admin)/gallery/new/tabs";
import type { PickerImage } from "@/app/(admin)/gallery/new/composer";
import type { TemplateOption } from "@/app/(admin)/gallery/new/template-tab";
import type { FormImage } from "@/app/(admin)/gallery/new/template-vars-form";
import { EmbeddedAddMedia } from "./embedded-add-media";

// Le composer PDF n'embarque que PNG et JPEG : ne proposer que ces formats.
const PDF_MIMES = new Set(["image/png", "image/jpeg"]);

// Page embarquée dans une iframe par les autres apps de la suite (ex. cast) pour
// créer un média sans quitter l'app appelante. Réutilise exactement les onglets de
// la modal d'ajout admin ; à la complétion, remonte le média au parent par
// postMessage (cf. embedded-add-media.tsx). Protégée par le middleware (cookie SSO
// cross-subdomain présent dans l'iframe).
export default async function EmbedNewPage({
  searchParams,
}: {
  searchParams: Promise<{ parentOrigin?: string; tab?: string }>;
}) {
  const userId = await requireUserId();
  const { parentOrigin, tab: tabParam } = await searchParams;

  if (!isAllowedParentOrigin(parentOrigin)) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        Origine parente non autorisée pour l&apos;embarquement.
      </main>
    );
  }

  const [styles, images, renders, templates] = await Promise.all([
    listStyles(userId),
    listMediaRecords(userId, { kind: "image", limit: 100 }),
    listMediaRecords(userId, { kind: "render", limit: 100 }),
    listTemplates(userId),
  ]);

  const sorted = [...images, ...renders].sort((a, b) => b.created_at - a.created_at);

  const pickable: PickerImage[] = sorted
    .filter((m) => PDF_MIMES.has(m.mime))
    .map((m) => ({ id: m.id, url: m.url }));

  const templateImages: FormImage[] = sorted.map((m) => ({ id: m.id, url: m.url }));

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
    <EmbeddedAddMedia
      // parentOrigin est validé juste au-dessus → non-null ici.
      parentOrigin={parentOrigin as string}
      initialTab={resolveTab(tabParam)}
      styles={styles.map((s) => ({ id: s.id, name: s.name }))}
      images={pickable}
      templates={templateOptions}
      templateImages={templateImages}
    />
  );
}
