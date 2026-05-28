'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Idea } from '@/lib/db/schema';
import { updateIdeaAction } from '../actions';
import { DeleteIdeaDialog } from './delete-idea-dialog';

type Props = {
  idea: Idea;
};

export function IdeaCard({ idea }: Props) {
  const [briefValue, setBriefValue] = useState(idea.brief ?? '');
  const [titleValue, setTitleValue] = useState(idea.idea);
  const [savingTitle, startSaveTitle] = useTransition();
  const [savingBrief, startSaveBrief] = useTransition();

  const saveTitle = () => {
    if (titleValue.trim() === idea.idea.trim() || !titleValue.trim()) return;
    startSaveTitle(async () => {
      const r = await updateIdeaAction({ id: idea.id, idea: titleValue.trim() });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const saveBrief = () => {
    if ((briefValue.trim() || null) === (idea.brief?.trim() || null)) return;
    startSaveBrief(async () => {
      const r = await updateIdeaAction({ id: idea.id, brief: briefValue });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          #{idea.id.slice(0, 8)} · {new Date(idea.createdAt).toLocaleDateString('fr-FR')}
        </span>
        <DeleteIdeaDialog
          ideaId={idea.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer l'idée">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </header>

      <Input
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        onBlur={saveTitle}
        placeholder="Titre de l'idée"
        disabled={savingTitle}
      />

      <Textarea
        value={briefValue}
        onChange={(e) => setBriefValue(e.target.value)}
        onBlur={saveBrief}
        placeholder="Brief : angle, contexte, exemples..."
        rows={3}
        disabled={savingBrief}
      />
    </article>
  );
}
