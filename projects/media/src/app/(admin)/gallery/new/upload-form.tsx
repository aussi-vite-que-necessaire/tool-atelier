"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadAction } from "../actions";
import { type CreatedMedia, toCreatedMedia } from "@/lib/embed/contract";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Formulaire d'upload partagé par la modal admin et la page embarquée. En mode
// embarqué, `onCreated` est fourni : on remonte le média créé au parent. En admin,
// `onCreated` est absent → `revalidatePath('/gallery')` rafraîchit la galerie.
export function UploadForm({ onCreated }: { onCreated?: (m: CreatedMedia) => void }) {
  const [state, action, pending] = useActionState(uploadAction, {});
  const lastNotified = useRef<string | null>(null);

  useEffect(() => {
    if (state.id && state.url && onCreated && lastNotified.current !== state.id) {
      lastNotified.current = state.id;
      onCreated(
        toCreatedMedia({
          id: state.id,
          url: state.url,
          kind: state.kind ?? "image",
          width: state.width ?? null,
          height: state.height ?? null,
        }),
      );
    }
  }, [state, onCreated]);

  return (
    <form action={action} className="max-w-md space-y-3">
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
      <Button type="submit" disabled={pending}>
        {pending ? "Upload…" : "Uploader"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
