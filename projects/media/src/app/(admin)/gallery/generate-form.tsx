"use client";

import { useActionState } from "react";
import { generateAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const RATIOS = ["1:1", "16:9", "9:16", "4:5", "4:3"];

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface StyleOption {
  id: string;
  name: string;
}

export function GenerateForm({ styles }: { styles: StyleOption[] }) {
  const [state, action, pending] = useActionState(generateAction, {});

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
            <Label className="flex-col items-start gap-1 text-xs text-muted-foreground">
              Ratio
              <select name="aspectRatio" defaultValue="1:1" className={selectClass}>
                {RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex-col items-start gap-1 text-xs text-muted-foreground">
              Style
              <select name="styleId" defaultValue="" className={selectClass}>
                <option value="">Aucun style</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Label>
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
