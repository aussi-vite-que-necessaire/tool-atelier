'use client';

import { Sparkles } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { generateAction } from '../actions';
import { CreationSuccess } from '../creation-feedback';

const RATIOS = ['1:1', '16:9', '9:16', '4:5', '4:3'];
const NO_STYLE = '__none__';

type StyleOption = { id: string; name: string };

export function GenerateForm({
  geminiAvailable,
  styles,
}: {
  geminiAvailable: boolean;
  styles: StyleOption[];
}) {
  const [state, action, pending] = useActionState(generateAction, {});
  const [styleId, setStyleId] = useState<string>(NO_STYLE);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.id !== lastSeen.current) {
      lastSeen.current = state.id;
      setDone(true);
    }
  }, [state]);

  if (!geminiAvailable) {
    return (
      <p className="rounded-lg bg-muted/40 px-4 py-3 text-muted-foreground text-sm">
        La génération IA est indisponible dans cet environnement (GEMINI_API_KEY absente). Utilise
        l'import.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {done && (
        <CreationSuccess
          message="Image générée et ajoutée à la galerie."
          onContinue={() => {
            setDone(false);
            setStyleId(NO_STYLE);
            formRef.current?.reset();
          }}
        />
      )}
      <form ref={formRef} action={action} className="space-y-3">
        <Textarea
          name="prompt"
          required
          rows={3}
          placeholder="Décris l'image : sujet, style, composition, couleurs, ambiance…"
        />
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col items-start gap-1">
            <Label className="text-muted-foreground text-xs">Ratio</Label>
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
            <Label className="text-muted-foreground text-xs">Style</Label>
            <input type="hidden" name="styleId" value={styleId === NO_STYLE ? '' : styleId} />
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
          <Sparkles className="h-4 w-4" />
          {pending ? 'Génération…' : 'Générer'}
        </Button>
      </form>
    </div>
  );
}
