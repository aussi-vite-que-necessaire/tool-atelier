'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { validateModuleInput } from '@/lib/ressources/module-input';
import { moveInList } from '@/lib/ressources/reorder';
import * as service from '@/lib/ressources/service';
import { requireOperator } from './authz';

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return v == null ? undefined : String(v);
}
function parsePath(s: string | undefined): string[] {
  return s ? s.split('/').filter(Boolean) : [];
}
function revalidateResource(slug: string) {
  revalidatePath('/ressources');
  revalidatePath(`/ressources/r/${slug}`, 'layout');
}

export async function createResourceAction(fd: FormData) {
  const op = await requireOperator();
  const title = str(fd, 'title') ?? 'Nouvelle ressource';
  const { slug } = await service.createResource(op, { title });
  redirect(`/ressources/r/${slug}`);
}

export async function updateResourceMetaAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'slug')!;
  await service.updateResource(op, slug, {
    title: str(fd, 'title'),
    description: str(fd, 'description'),
    coverImageUrl: str(fd, 'coverImageUrl'),
    visibility: (str(fd, 'visibility') as 'public' | 'private') ?? undefined,
    published: fd.get('published') === 'on',
    featured: fd.get('featured') === 'on',
  });
  revalidateResource(slug);
}

export async function deleteResourceAction(fd: FormData) {
  const op = await requireOperator();
  await service.deleteResource(op.userId, str(fd, 'slug')!);
  revalidatePath('/ressources');
  redirect('/ressources');
}

export async function addPageAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  await service.addPage(op.userId, {
    resourceSlug: slug,
    parentPath: parsePath(str(fd, 'parentPath')),
    slug: str(fd, 'slug') ?? 'page',
    title: str(fd, 'title') ?? 'Page',
  });
  revalidateResource(slug);
}

export async function renamePageAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  await service.updatePage(op.userId, {
    resourceSlug: slug,
    path: parsePath(str(fd, 'path')),
    patch: { title: str(fd, 'title'), slug: str(fd, 'slug') || undefined },
  });
  revalidateResource(slug);
}

export async function deletePageAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  await service.deletePage(op.userId, { resourceSlug: slug, path: parsePath(str(fd, 'path')) });
  revalidateResource(slug);
}

export async function movePageAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  const ids = (str(fd, 'orderedIds') ?? '').split(',').filter(Boolean);
  const reordered = moveInList(ids, str(fd, 'id')!, str(fd, 'direction') as 'up' | 'down');
  await service.reorderPages(op.userId, reordered);
  revalidateResource(slug);
}

export async function addModuleAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  const m = validateModuleInput({
    type: str(fd, 'type'),
    content: JSON.parse(str(fd, 'content') ?? '{}'),
  });
  await service.addModule(op.userId, {
    resourceSlug: slug,
    path: parsePath(str(fd, 'path')),
    module: m,
  });
  revalidateResource(slug);
}

export async function updateModuleAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  const m = validateModuleInput({
    type: str(fd, 'type'),
    content: JSON.parse(str(fd, 'content') ?? '{}'),
  });
  await service.updateModule(op.userId, { id: str(fd, 'id')!, content: m.content });
  revalidateResource(slug);
}

export async function deleteModuleAction(fd: FormData) {
  const op = await requireOperator();
  await service.deleteModule(op.userId, { id: str(fd, 'id')! });
  revalidateResource(str(fd, 'resourceSlug')!);
}

export async function moveModuleAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  const ids = (str(fd, 'orderedIds') ?? '').split(',').filter(Boolean);
  const reordered = moveInList(ids, str(fd, 'id')!, str(fd, 'direction') as 'up' | 'down');
  await service.reorderModules(op.userId, { orderedModuleIds: reordered });
  revalidateResource(slug);
}

export async function grantAccessAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  await service.grantAccess(op.userId, { resourceSlug: slug, email: str(fd, 'email')! });
  revalidateResource(slug);
}

export async function revokeAccessAction(fd: FormData) {
  const op = await requireOperator();
  const slug = str(fd, 'resourceSlug')!;
  await service.revokeAccess(op.userId, { resourceSlug: slug, email: str(fd, 'email')! });
  revalidateResource(slug);
}
