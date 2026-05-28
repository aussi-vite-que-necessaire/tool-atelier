export const dynamic = "force-dynamic";

import { listMediaRecords } from "@/lib/media/repository";
import { Composer, type PickerImage } from "./composer";

// buildPdf n'embarque que PNG et JPEG : ne proposer que ces formats.
const PDF_MIMES = new Set(["image/png", "image/jpeg"]);

export default async function PdfPage() {
  const [images, renders] = await Promise.all([
    listMediaRecords({ kind: "image", limit: 100 }),
    listMediaRecords({ kind: "render", limit: 100 }),
  ]);

  const items: PickerImage[] = [...images, ...renders]
    .filter((m) => PDF_MIMES.has(m.mime))
    .sort((a, b) => b.created_at - a.created_at)
    .map((m) => ({ id: m.id, url: m.url }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Composer un PDF</h1>
        <p className="text-sm text-gray-500">
          Sélectionne des images (PNG/JPEG) dans l&apos;ordre voulu : une image par page.
        </p>
      </div>
      <Composer images={items} />
    </div>
  );
}
