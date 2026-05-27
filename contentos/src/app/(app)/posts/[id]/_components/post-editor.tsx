'use client';

import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Post, VisualTemplate } from '@/lib/db/schema';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { updatePostAction } from '../../actions';
import { AddVisualDialog } from './add-visual-dialog';
import { DeletePostDialog } from './delete-post-dialog';
import type { TemplatePreview } from './template-thumbnail';
import { VisualDisplay } from './visual-display';

type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  url: string;
};
type MediaInfo = {
  kind: 'image' | 'carousel' | 'video';
  url: string;
  width: number;
  height: number;
  slideUrls?: string[];
};

type Props = {
  post: Post;
  templates: VisualTemplate[];
  templatePreviews: TemplatePreview[];
  styles: { id: string; name: string }[];
  galleryImages: GalleryImage[];
  mediaInfo: MediaInfo | null;
  author: LinkedInAuthor;
};

export function PostEditor({
  post,
  templates,
  templatePreviews,
  styles,
  galleryImages,
  mediaInfo,
  author,
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
        toast.success(next === 'validated' ? 'Post validé' : 'Remis en draft');
      } else if (r.status === 'error') {
        toast.error(r.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            placeholder="Titre du post"
            disabled={savingTitle}
            className="text-lg font-bold"
          />
          <Badge variant={status === 'validated' ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Post #{post.id.slice(0, 8)} · créé le{' '}
          {new Date(post.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Visuel</h2>
        {mediaInfo ? (
          <VisualDisplay
            postId={post.id}
            kind={mediaInfo.kind}
            url={mediaInfo.url}
            slideUrls={mediaInfo.slideUrls}
            onReplaceClick={() => setDialogOpen(true)}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <ImageIcon className="h-4 w-4 mr-2" />
            Ajouter un visuel
          </Button>
        )}
      </section>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        rows={20}
        disabled={saving}
        className="font-mono"
      />

      <section className="space-y-2">
        <h2 className="font-semibold text-muted-foreground text-sm">Aperçu LinkedIn</h2>
        <LinkedInPostPreview
          author={author}
          content={content}
          image={mediaInfo && mediaInfo.kind === 'image' ? { url: mediaInfo.url } : null}
        />
      </section>

      <footer className="flex items-center justify-between gap-3">
        <Button onClick={toggleStatus} disabled={toggling}>
          {status === 'draft' ? 'Valider' : 'Remettre en draft'}
        </Button>
        <DeletePostDialog
          postId={post.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer le post">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </footer>

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
