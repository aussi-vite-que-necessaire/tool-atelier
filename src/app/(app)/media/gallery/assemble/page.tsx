import { Heading } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { isStorageConfigured } from '@/lib/media/config';
import { listMediaRecords } from '@/lib/media/repository';
import { BackToGallery } from '../creation-feedback';
import { AssemblePicker } from './assemble-picker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assembler un PDF — Media' };

export default async function AssemblePdfPage() {
  const userId = await requireUserId();
  const storage = isStorageConfigured();
  const records = storage ? await listMediaRecords(userId, { kind: 'image', limit: 100 }) : [];
  const images = records.map((r) => ({ id: r.id, url: r.url, prompt: r.prompt }));

  return (
    <div className="space-y-6">
      <BackToGallery />
      <div className="space-y-1">
        <Heading level={1}>Assembler un PDF</Heading>
        <p className="text-muted-foreground text-sm">
          Choisis des images dans l'ordre voulu ; elles sont réunies dans un seul PDF ajouté à la
          galerie.
        </p>
      </div>
      <AssemblePicker images={images} />
    </div>
  );
}
