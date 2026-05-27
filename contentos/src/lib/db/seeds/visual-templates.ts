import { VISUAL_TEMPLATE_SEEDS } from '@/lib/visual-templates/seeds';
import { createVisualTemplate, getVisualTemplateBySlug } from '../repositories/visual-templates';

export async function seedVisualTemplates(
  userId: string,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const seed of VISUAL_TEMPLATE_SEEDS) {
    if (await getVisualTemplateBySlug(userId, seed.slug)) {
      console.log(`  skip  ${seed.slug} (existe déjà)`);
      skipped++;
      continue;
    }
    const row = await createVisualTemplate(userId, seed);
    console.log(row ? `  add   ${seed.slug} → ${row.id}` : `  fail  ${seed.slug} (conflit)`);
    if (row) created++;
  }
  return { created, skipped };
}
