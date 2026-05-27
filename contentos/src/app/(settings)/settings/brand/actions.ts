'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { removeBrandLogoCore, uploadBrandLogoCore } from '@/lib/media/brand-logo-core';
import { type BrandActionState, updateBrandSettingsCore } from './actions-core';

export async function updateBrandSettings(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { status: 'error', message: 'unauthenticated' };
  }
  const result = await updateBrandSettingsCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/brand');
  }
  return result;
}

export type LogoActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export async function uploadBrandLogo(
  _prev: LogoActionState,
  formData: FormData,
): Promise<LogoActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Aucun fichier' };
  }

  const result = await uploadBrandLogoCore(session.user.id, file);
  if (result.status === 'error') return result;
  revalidatePath('/settings/brand');
  return { status: 'success' };
}

export async function removeBrandLogo(_prev: LogoActionState): Promise<LogoActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  await removeBrandLogoCore(session.user.id);
  revalidatePath('/settings/brand');
  return { status: 'success' };
}
