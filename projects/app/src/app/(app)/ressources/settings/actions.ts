'use server';

import { revalidatePath } from 'next/cache';
import { saveOperatorSettings } from '@/lib/ressources/settings';
import { parseSettingsInput, type SettingsInput } from '@/lib/ressources/settings-validate';
import { requireOperator } from '../authz';

export async function saveSettingsAction(raw: SettingsInput): Promise<{ ok: boolean }> {
  const op = await requireOperator();
  const clean = parseSettingsInput(raw);
  if (!clean) return { ok: false };
  await saveOperatorSettings(op.userId, { brandName: clean.brandName, theme: clean.theme });
  revalidatePath('/ressources/settings');
  return { ok: true };
}
