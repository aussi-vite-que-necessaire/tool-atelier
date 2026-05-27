'use client';

import { ArrowLeft, Check, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Post, Publication, VisualTemplate } from '@/lib/db/schema';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { cn } from '@/lib/utils';
import { updatePostAction } from '../../actions';
import { AddVisualDialog } from './add-visual-dialog';
import { DeletePostDialog } from './delete-post-dialog';
import { type MediaInfo, PostComposer } from './post-composer';
import { PublishPanel } from './publish-panel';
import type { TemplatePreview } from './template-thumbnail';

const STATUS_LABEL = { draft: 'brouillon', validated: 'validé' } as const;

type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  url: string;
};

type Props = {
  post: Post;
  templates: VisualTemplate[];
  templatePreviews: TemplatePreview[];
  styles: { id: string; name: string }[];
  galleryImages: GalleryImage[];
  mediaInfo: MediaInfo | null;
  author: LinkedInAuthor;
  publication: Publication | null;
};

export function PostEditor({
  post,
  templates,
  templatePreviews,
  styles,
  galleryImages,
  mediaInfo,
  author,
  publication,
}: Props) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [status, setStatus] = useState<'draft' | 'validated'>(post.status);
  const [savingTitle, startSaveTitle] = useTransition();
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const saveTitle = () => {
    if (title.trim() === post.title.trim() || !title.trim()) return;
    startSaveTitle(async () => {
      const r = await updatePostAction({ id: post.id, title: title.trim() });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const saveContent = () => {
    if (content.trim() === post.content.trim() || !content.trim()) return;
    startSave(async () => {
      const r = await updatePostAction({ id: post.id, content });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const toggleStatus = () => {
    const next: 'draft' | 'validated' = status === 'draft' ? 'validated' : 'draft';
    startToggle(async () => {
      const r = await updatePostAction({ id: post.id, status: next });
      if (r.status === 'success') {
        setStatus(next);
        toast.success(next === 'validated' ? 'Post validé' : 'Remis en brouillon');
      } else if (r.status === 'error') {
        toast.error(r.message);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/posts"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
        >
          <ArrowLeft className="h-4 w-4" />
          Tous les posts
        </Link>
        <Badge variant={status === 'validated' ? 'default' : 'secondary'}>
          {STATUS_LABEL[status]}
        </Badge>
        <div className="flex-1" />
        <DeletePostDialog
          postId={post.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer le post">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
        {status === 'draft' ? (
          <Button onClick={toggleStatus} disabled={toggling}>
            <Check className="h-4 w-4" />
            {toggling ? 'Validation…' : 'Valider'}
          </Button>
        ) : (
          <Button variant="outline" onClick={toggleStatus} disabled={toggling}>
            <Undo2 className="h-4 w-4" />
            {toggling ? 'Mise à jour…' : 'Repasser en brouillon'}
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PostComposer
          postId={post.id}
          author={author}
          content={content}
          onContentChange={setContent}
          onContentBlur={saveContent}
          saving={saving}
          mediaInfo={mediaInfo}
          onAddVisual={() => setDialogOpen(true)}
        />

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Label htmlFor="post-title">Titre interne</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              placeholder="Pour t'y retrouver"
              maxLength={200}
              disabled={savingTitle}
            />
            <p className="text-muted-foreground text-xs">
              Sert au classement ici. N'apparaît pas dans le post publié.
            </p>
          </div>

          <PublishPanel postId={post.id} publication={publication} />
        </aside>
      </div>

      <AddVisualDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        postId={post.id}
        templates={templates}
        templatePreviews={templatePreviews}
        styles={styles}
        galleryImages={galleryImages}
      />
    </div>
  );
}
