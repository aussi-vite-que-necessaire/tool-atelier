import { Heading } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { BackToGallery } from '../creation-feedback';
import { ImportForm } from './import-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Importer — Media' };

export default async function ImportMediaPage() {
  await requireUserId();

  return (
    <div className="max-w-xl space-y-6">
      <BackToGallery />
      <div className="space-y-1">
        <Heading level={1}>Importer un média</Heading>
        <p className="text-muted-foreground text-sm">
          Ajoute une image, un PDF ou une vidéo depuis ton appareil. Le média rejoint la galerie.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
