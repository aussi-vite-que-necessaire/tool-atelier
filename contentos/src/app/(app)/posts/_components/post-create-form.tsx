'use client';

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
      if (r.status === 'success') router.push(`/posts/${r.postId}`);
      else toast.error(r.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3 rounded-lg border p-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du post"
        maxLength={200}
        disabled={pending}
      />
      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? 'Création…' : 'Créer un post'}
      </Button>
    </form>
  );
}
