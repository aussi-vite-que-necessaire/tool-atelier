import { Heading } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { isGeminiConfigured, isStorageConfigured } from '@/lib/media/config';
import { listStyles } from '@/lib/media/styles';
import { BackToGallery } from '../creation-feedback';
import { GenerateForm } from './generate-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Générer (IA) — Media' };

export default async function GenerateMediaPage() {
  const userId = await requireUserId();
  const storage = isStorageConfigured();
  const styles = storage ? await listStyles(userId) : [];

  return (
    <div className="max-w-xl space-y-6">
      <BackToGallery />
      <div className="space-y-1">
        <Heading level={1}>Générer une image (IA)</Heading>
        <p className="text-muted-foreground text-sm">
          Décris ce que tu veux : Gemini produit une image et l'ajoute à la galerie.
        </p>
      </div>
      <GenerateForm geminiAvailable={storage && isGeminiConfigured()} styles={styles} />
    </div>
  );
}
