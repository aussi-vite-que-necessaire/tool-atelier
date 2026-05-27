import Link from 'next/link';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { TemplateCard } from './_components/template-card';
import { toTemplateCardData } from './_components/template-card-data';

export default async function VisualTemplatesListPage() {
  const userId = await requireUserId();
  const [templates, brand] = await Promise.all([
    listVisualTemplates(userId),
    buildBrandContext(userId),
  ]);

  const cards = toTemplateCardData(templates, brand);

  return (
    <SettingsPage
      title="Templates visuels"
      description="HTML+CSS+variables pour générer des visuels."
      action={
        <Button nativeButton={false} render={<Link href="/settings/visual-templates/new" />}>
          + Nouveau
        </Button>
      }
    >
      {cards.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun template pour le moment.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <TemplateCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </SettingsPage>
  );
}
