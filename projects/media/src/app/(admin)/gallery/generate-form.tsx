"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { generateAction } from "./actions";
import { type CreatedMedia, toCreatedMedia } from "@/lib/embed/contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const RATIOS = ["1:1", "16:9", "9:16", "4:5", "4:3"];

// Valeur sentinelle « aucun style » : base-ui Select n'accepte pas "" comme item,
// on mappe donc cette option sur null (le champ caché soumet une chaîne vide).
const NO_STYLE = "__none__";

interface StyleOption {
  id: string;
  name: string;
}

export function GenerateForm({
  styles,
  onCreated,
}: {
  styles: StyleOption[];
  onCreated?: (m: CreatedMedia) => void;
}) {
  const [state, action, pending] = useActionState(generateAction, {});
  // Select contrôlé : la sentinelle NO_STYLE est soumise comme "" (contrat de
  // generateAction : "" → aucun style), via un champ caché.
  const [styleId, setStyleId] = useState<string>(NO_STYLE);

  // Mode embarqué : remonte le média généré au parent (une seule fois par id).
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
    <Card>
      <CardHeader>
        <CardTitle>Générer avec l&apos;IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={action} className="space-y-3">
          <Textarea
            name="prompt"
            required
            rows={3}
            placeholder="Décris l'image : sujet, style, composition, couleurs, ambiance…"
          />
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col items-start gap-1">
              <Label className="text-xs text-muted-foreground">Ratio</Label>
              <Select name="aspectRatio" defaultValue="1:1">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATIOS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-start gap-1">
              <Label className="text-xs text-muted-foreground">Style</Label>
              <input type="hidden" name="styleId" value={styleId === NO_STYLE ? "" : styleId} />
              <Select value={styleId} onValueChange={(v) => setStyleId((v as string) ?? NO_STYLE)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_STYLE}>Aucun style</SelectItem>
                  {styles.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Génération…" : "Générer"}
          </Button>
        </form>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        {state.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.url}
            alt="Image générée"
            className="max-w-full rounded-lg ring-1 ring-foreground/10"
          />
        )}
      </CardContent>
    </Card>
  );
}
