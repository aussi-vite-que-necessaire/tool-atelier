import { z } from 'zod';
import { updateSettings } from '@/lib/db/repositories/settings';

export type BrandActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const brandSchema = z.object({
  brand_name: z.string().max(100),
  brand_signature: z.string().max(1000),
});

export async function updateBrandSettingsCore(
  userId: string,
  formData: FormData,
): Promise<BrandActionState> {
  const raw = {
    brand_name: String(formData.get('brand_name') ?? ''),
    brand_signature: String(formData.get('brand_signature') ?? ''),
  };

  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateSettings(userId, {
    brandName: parsed.data.brand_name,
    brandSignature: parsed.data.brand_signature,
  });

  return { status: 'success' };
}
