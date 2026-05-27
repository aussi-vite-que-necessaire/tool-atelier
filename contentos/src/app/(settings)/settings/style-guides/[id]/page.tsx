import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { getStyleGuide } from '@/lib/db/repositories/style-guides';
import { listVisualTemplatesByStyleGuide } from '@/lib/db/repositories/visual-templates';
import { renderMarkdown } from '@/lib/markdown';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { TemplateCard } from '../../visual-templates/_components/template-card';
import { toTemplateCardData } from '../../visual-templates/_components/template-card-data';
import { StyleGuideForm } from '../style-guide-form';
import { deleteStyleGuideActionRaw, updateStyleGuideAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditStyleGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const guide = await getStyleGuide(session.user.id, id);
  if (!guide) notFound();

  const [templates, brand] = await Promise.all([
    listVisualTemplatesByStyleGuide(session.user.id, id),
    buildBrandContext(session.user.id),
  ]);
  const cards = toTemplateCardData(templates, brand);

  const updateAction = updateStyleGuideAction.bind(null, id);
  const deleteAction = deleteStyleGuideActionRaw.bind(null, id);

  return (
    <SettingsPage title="Éditer le style guide">
      <SettingsCard>
        <StyleGuideForm
          mode="edit"
          initial={{ name: guide.name, content: guide.content }}
          action={updateAction}
          successMessage="Style guide mis à jour"
        />
      </SettingsCard>
      <SettingsCard title="Aperçu">
        <div
          className="max-w-none text-sm text-neutral-800 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: contenu markdown de l'auteur, back-office authentifié
          dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.content) }}
        />
      </SettingsCard>
      <SettingsCard title="Templates rattachés">
        {cards.length === 0 ? (
          <p className="text-sm text-neutral-600">Aucun template rattaché.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <TemplateCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
