export const dynamic = "force-dynamic";

import { getBrand } from "@/lib/brand/repository";
import { requireUserId } from "@/lib/session";
import { saveBrandAction } from "./actions";

export default async function BrandPage() {
  const userId = await requireUserId();
  const brand = await getBrand(userId);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Marque</h1>
        <p className="mt-1 text-sm text-gray-500">
          Injectée dans les templates via{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{brand.name}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{brand.signature}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{brand.logo}}"}</code>.
        </p>
      </div>

      <form action={saveBrandAction} className="space-y-4 border border-gray-200 rounded p-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="brand-name">
            Nom
          </label>
          <input
            id="brand-name"
            name="name"
            type="text"
            defaultValue={brand?.name ?? ""}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="brand-signature">
            Signature
          </label>
          <textarea
            id="brand-signature"
            name="signature"
            rows={3}
            defaultValue={brand?.signature ?? ""}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1" htmlFor="brand-logo">
            URL du logo
          </label>
          <input
            id="brand-logo"
            name="logoUrl"
            type="url"
            defaultValue={brand?.logoUrl ?? ""}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            placeholder="https://..."
          />
        </div>
        <button
          type="submit"
          className="bg-gray-800 text-white text-sm rounded px-3 py-1.5 hover:bg-gray-700"
        >
          Enregistrer
        </button>
      </form>
    </div>
  );
}
