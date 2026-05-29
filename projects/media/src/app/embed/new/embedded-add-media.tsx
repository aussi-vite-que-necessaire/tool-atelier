"use client";

import { useCallback, useState } from "react";
import { GenerateForm } from "@/app/(admin)/gallery/generate-form";
import { Composer, type PickerImage } from "@/app/(admin)/gallery/new/composer";
import { TemplateTab, type TemplateOption } from "@/app/(admin)/gallery/new/template-tab";
import type { FormImage } from "@/app/(admin)/gallery/new/template-vars-form";
import { UploadForm } from "@/app/(admin)/gallery/new/upload-form";
import { TABS, type Tab } from "@/app/(admin)/gallery/new/tabs";
import { type CreatedMedia, MEDIA_CREATED } from "@/lib/embed/contract";
import { Button } from "@/components/ui/button";

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

// Coquille embarquée (iframe) : mêmes onglets que la modal admin, mais le
// changement d'onglet se fait en état local (pas de navigation iframe) et la
// complétion remonte le média au parent via postMessage (au lieu de naviguer
// vers /gallery ou d'afficher inline). `parentOrigin` est déjà validé côté serveur.
export function EmbeddedAddMedia({
  parentOrigin,
  initialTab,
  styles,
  images,
  templates,
  templateImages,
}: {
  parentOrigin: string;
  initialTab: Tab;
  styles: StyleOption[];
  images: PickerImage[];
  templates: TemplateOption[];
  templateImages: FormImage[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const onCreated = useCallback(
    (media: CreatedMedia) => {
      window.parent.postMessage({ type: MEDIA_CREATED, media }, parentOrigin);
    },
    [parentOrigin],
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-3">
        {TABS.map((t) => (
          <Button
            key={t}
            type="button"
            variant={t === tab ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === "upload" && <UploadForm onCreated={onCreated} />}
        {tab === "generate" && <GenerateForm styles={styles} onCreated={onCreated} />}
        {tab === "pdf" && <Composer images={images} onCreated={onCreated} />}
        {tab === "template" && (
          <TemplateTab templates={templates} images={templateImages} onCreated={onCreated} />
        )}
      </div>
    </div>
  );
}
