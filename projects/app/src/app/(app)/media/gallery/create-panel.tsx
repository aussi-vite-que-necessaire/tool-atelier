'use client';

import { ImageIcon, Sparkles, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { generateAction, uploadAction } from './actions';

const RATIOS = ['1:1', '16:9', '9:16', '4:5', '4:3'];
const NO_STYLE = '__none__';

type StyleOption = { id: string; name: string };
type Mode = 'generate' | 'upload';

export function CreatePanel({
  geminiAvailable,
  styles,
}: {
  geminiAvailable: boolean;
  styles: StyleOption[];
}) {
  const [mode, setMode] = useState<Mode>(geminiAvailable ? 'generate' : 'upload');

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex gap-1">
          <ModeTab
            active={mode === 'generate'}
            onClick={() => setMode('generate')}
            icon={<Sparkles className="h-4 w-4" />}
            label="Générer (IA)"
          />
          <ModeTab
            active={mode === 'upload'}
            onClick={() => setMode('upload')}
            icon={<Upload className="h-4 w-4" />}
            label="Importer"
          />
        </div>

        {mode === 'generate' ? (
          <GenerateForm geminiAvailable={geminiAvailable} styles={styles} />
        ) : (
          <UploadForm />
        )}
      </CardContent>
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function GenerateForm({
  geminiAvailable,
  styles,
}: {
  geminiAvailable: boolean;
  styles: StyleOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(generateAction, {});
  const [styleId, setStyleId] = useState<string>(NO_STYLE);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.id !== lastSeen.current) {
      lastSeen.current = state.id;
      toast.success('Image générée');
      router.refresh();
    }
  }, [state, router]);

  if (!geminiAvailable) {
    return (
      <p className="rounded-lg bg-muted/40 px-4 py-3 text-muted-foreground text-sm">
        La génération IA est indisponible dans cet environnement (GEMINI_API_KEY absente). Utilise
        l'import.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
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
  );
}

function UploadForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.id !== lastSeen.current) {
      lastSeen.current = state.id;
      toast.success('Média importé');
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Label htmlFor="media-file" className="text-muted-foreground text-xs">
        Fichier (image, PDF ou vidéo mp4)
      </Label>
      <input
        id="media-file"
        type="file"
        name="file"
        required
        accept="image/png,image/jpeg,image/webp,application/pdf,video/mp4"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground file:text-sm hover:file:bg-secondary/80"
      />
      <Button type="submit" disabled={pending}>
        <ImageIcon className="h-4 w-4" />
        {pending ? 'Import…' : 'Importer'}
      </Button>
    </form>
  );
}
