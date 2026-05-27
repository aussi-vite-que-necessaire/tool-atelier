import { notFound } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { requireUserId } from '@/lib/auth/session';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { PreviewPanel } from '../preview-panel';
import { type VisualTemplateActionState, VisualTemplateForm } from '../visual-template-form';
import { updateVisualTemplateAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditVisualTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, id);
  if (!t) notFound();

  const boundAction = async (
    prev: VisualTemplateActionState,
    formData: FormData,
  ): Promise<VisualTemplateActionState> => {
    'use server';
    return updateVisualTemplateAction(id, prev, formData);
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Visual templates
        </p>
        <h2 className="text-2xl font-semibold text-neutral-900">{t.label}</h2>
        <p className="text-xs text-muted-foreground">
          {t.platform} · {t.slug} · {t.width}×{t.height}
        </p>
      </header>
      <VisualTemplateForm
        mode="edit"
        initial={{
          label: t.label,
          slug: t.slug,
          platform: t.platform,
          width: t.width,
          height: t.height,
          bodyHtml: t.bodyHtml,
          css: t.css,
          variablesSchema: t.variablesSchema as VariableSpec[],
          sampleVars: JSON.stringify(t.sampleVars, null, 2),
        }}
        action={boundAction}
        successMessage="Template enregistré"
      />
      <SettingsCard
        title="Aperçu image (PNG)"
        description="Rendu final via le moteur média, pour vérifier polices et exports."
      >
        <PreviewPanel templateId={t.id} sampleVars={t.sampleVars as Record<string, unknown>} />
      </SettingsCard>
      <SettingsCard title="Zone dangereuse">
        <DangerZone id={t.id} label={t.label} />
      </SettingsCard>
    </div>
  );
}
