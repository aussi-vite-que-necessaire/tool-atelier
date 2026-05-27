import { updateSettings } from '@/lib/db/repositories/settings';
import { getMediaEngine } from '@/lib/media-engine';
import { validateUploadFile } from './validate-upload';

// Le logo est une propriété singleton de la marque : on stocke directement l'URL
// publique renvoyée par le media engine dans settings.brandLogoUrl, sans passer
// par la table media/la galerie.
export async function uploadBrandLogoCore(
  userId: string,
  file: File,
): Promise<{ status: 'success'; url: string } | { status: 'error'; message: string }> {
  const v = validateUploadFile({ type: file.type, size: file.size });
  if (!v.ok) return { status: 'error', message: v.message };

  const bytes = Buffer.from(await file.arrayBuffer());
  const obj = await getMediaEngine().upload({ bytes, contentType: file.type });

  await updateSettings(userId, { brandLogoUrl: obj.url });
  return { status: 'success', url: obj.url };
}

export async function removeBrandLogoCore(userId: string): Promise<void> {
  await updateSettings(userId, { brandLogoUrl: null });
}
