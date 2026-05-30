import { Heading } from '@/components/ui/typography';
import { DEFAULT_PRESET_ID, type ThemeConfig } from '@/lib/ressources/theme';
import { requireOperator } from '../authz';
import { ThemeEditor } from './theme-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Réglages — Ressources' };

export default async function SettingsPage() {
  const op = await requireOperator();
  const theme: ThemeConfig = op.theme ?? { preset: DEFAULT_PRESET_ID, overrides: {} };

  return (
    <div>
      <header className="mb-8 space-y-1">
        <Heading level={1}>Réglages</Heading>
        <p className="max-w-2xl text-muted-foreground text-sm">
          Personnalise le nom et le thème de ton espace public (/docs/{op.handle}).
        </p>
      </header>
      <ThemeEditor initialBrandName={op.brandName ?? ''} initialTheme={theme} />
    </div>
  );
}
