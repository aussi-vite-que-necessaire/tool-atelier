'use client';

import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Post, Publication } from '@/lib/db/schema';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { cn } from '@/lib/utils';
import { updatePostAction } from '../../actions';
import { DeletePostDialog } from './delete-post-dialog';
import { MediaPicker } from './media-picker';
import { type MediaInfo, PostComposer } from './post-composer';
import { PublishPanel } from './publish-panel';

type Props = {
  post: Post;
  mediaInfo: MediaInfo | null;
  author: LinkedInAuthor;
  publication: Publication | null;
  embedSrc: string;
  embedOrigin: string;
  parentOrigin: string;
};

export function PostEditor({
  post,
  mediaInfo,
  author,
  publication,
  embedSrc,
  embedOrigin,
  parentOrigin,
}: Props) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [savingTitle, startSaveTitle] = useTransition();
  const [saving, startSave] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

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
        <div className="flex-1" />
        <DeletePostDialog
          postId={post.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer le post">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
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
          onAddVisual={() => setPickerOpen(true)}
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

          <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
            Choisir un média
          </Button>

          <PublishPanel postId={post.id} publication={publication} />
        </aside>
      </div>

      <MediaPicker
        postId={post.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        embedSrc={embedSrc}
        embedOrigin={embedOrigin}
        parentOrigin={parentOrigin}
      />
    </div>
  );
}
