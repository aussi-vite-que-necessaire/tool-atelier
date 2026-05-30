'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPostAction } from '../actions';

export function PostCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const r = await createPostAction({ title: title.trim() });
      if (r.status === 'success') router.push(`/cast/posts/${r.postId}`);
      else toast.error(r.message);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl bg-card p-2 ring-1 ring-foreground/10 sm:flex-row sm:items-center"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Le titre de ton prochain post…"
        maxLength={200}
        disabled={pending}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 sm:text-base"
      />
      <Button type="submit" disabled={pending || !title.trim()} className="shrink-0">
        <Plus className="mr-1.5 h-4 w-4" />
        {pending ? 'Création…' : 'Nouveau post'}
      </Button>
    </form>
  );
}
