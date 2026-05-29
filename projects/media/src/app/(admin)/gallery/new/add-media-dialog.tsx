"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadAction } from "../actions";
import { GenerateForm } from "../generate-form";
import { Composer, type PickerImage } from "./composer";
import { TemplateTab, type TemplateOption } from "./template-tab";
import type { FormImage } from "./template-vars-form";
import { TABS, type Tab } from "./tabs";

const TAB_LABELS: Record<Tab, string> = {
  upload: "Uploader un fichier",
  generate: "Générer une image (IA)",
  pdf: "Composer un PDF",
  template: "Rendre un template",
};

interface StyleOption {
  id: string;
  name: string;
}

export function AddMediaDialog({
  tab,
  styles,
  images,
  templates,
  templateImages,
}: {
  tab: Tab;
  styles: StyleOption[];
  images: PickerImage[];
  templates: TemplateOption[];
  templateImages: FormImage[];
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/gallery");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop : ferme au clic */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => router.push("/gallery")}
        className="absolute inset-0 bg-black/40"
      />

      {/* Panneau near-fullscreen */}
      <div className="relative m-auto flex h-[92vh] w-[95vw] max-w-5xl flex-col rounded-lg bg-white shadow-xl">
        {/* En-tête : onglets + fermeture */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t}
                href={`/gallery/new?tab=${t}`}
                className={`rounded px-3 py-1.5 text-sm ${
                  t === tab
                    ? "bg-gray-800 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {TAB_LABELS[t]}
              </Link>
            ))}
          </div>
          <Link
            href="/gallery"
            aria-label="Fermer"
            className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </Link>
        </div>

        {/* Contenu de l'onglet actif */}
        <div className="flex-1 overflow-auto p-6">
          {tab === "upload" && (
            <form action={uploadAction} className="max-w-md space-y-3">
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
                required
                className="block text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
              />
              <p className="text-xs text-gray-400">
                Types acceptés : PNG, JPEG, WebP (≤ 10 Mo), PDF (≤ 100 Mo), MP4 (≤ 100 Mo via l&apos;UI).
                Pour les vidéos jusqu&apos;à 500 Mo, utiliser l&apos;API <code>/v1/upload</code>.
              </p>
              <button
                type="submit"
                className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
              >
                Uploader
              </button>
            </form>
          )}

          {tab === "generate" && <GenerateForm styles={styles} />}

          {tab === "pdf" && <Composer images={images} />}

          {tab === "template" && (
            <TemplateTab templates={templates} images={templateImages} />
          )}
        </div>
      </div>
    </div>
  );
}
