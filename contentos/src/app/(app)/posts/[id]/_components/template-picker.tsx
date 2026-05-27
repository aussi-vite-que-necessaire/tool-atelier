'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { type TemplatePreview, TemplateThumbnail } from './template-thumbnail';

type Props = {
  previews: TemplatePreview[];
  onSelect: (id: string) => void;
};

export function TemplatePicker({ previews, onSelect }: Props) {
  const [zoom, setZoom] = useState<TemplatePreview | null>(null);

  if (previews.length === 0) {
    return (
      <div className="space-y-2 py-10 text-center">
        <p className="text-sm text-muted-foreground">Aucun template disponible.</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/settings/visual-templates/new" />}
        >
          Créer un template
        </Button>
      </div>
    );
  }

  const zoomScale = zoom ? Math.min(640 / zoom.width, 1) : 1;

  return (
    <>
      <div className="grid grid-cols-3 gap-3 pr-1">
        {previews.map((p) => (
          <TemplateThumbnail key={p.id} preview={p} onSelect={onSelect} onZoom={setZoom} />
        ))}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer l'aperçu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setZoom(null)}
          />
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white p-3">
            <div
              className="overflow-hidden"
              style={{ width: zoom.width * zoomScale, height: zoom.height * zoomScale }}
            >
              <iframe
                title={zoom.label}
                srcDoc={zoom.html}
                sandbox=""
                scrolling="no"
                style={{
                  width: zoom.width,
                  height: zoom.height,
                  border: 0,
                  transform: `scale(${zoomScale})`,
                  transformOrigin: '0 0',
                }}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  onSelect(zoom.id);
                  setZoom(null);
                }}
              >
                Choisir ce template
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
