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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        className="absolute inset-0 bg-black/40 supports-backdrop-filter:backdrop-blur-xs"
      />

      {/* Panneau near-fullscreen */}
      <div className="relative m-auto flex h-[92vh] w-[95vw] max-w-5xl flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10">
        {/* En-tête : onglets + fermeture */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button
                key={t}
                variant={t === tab ? "secondary" : "ghost"}
                size="sm"
                render={<Link href={`/gallery/new?tab=${t}`} />}
              >
                {TAB_LABELS[t]}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fermer"
            render={<Link href="/gallery" />}
          >
            ✕
          </Button>
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
                className={cn(
                  "block text-sm text-muted-foreground",
                  "file:mr-3 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:text-foreground hover:file:bg-muted",
                )}
              />
              <p className="text-xs text-muted-foreground">
                Types acceptés : PNG, JPEG, WebP (≤ 10 Mo), PDF (≤ 100 Mo), MP4 (≤ 100 Mo via l&apos;UI).
                Pour les vidéos jusqu&apos;à 500 Mo, utiliser l&apos;API <code>/v1/upload</code>.
              </p>
              <Button type="submit">Uploader</Button>
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
