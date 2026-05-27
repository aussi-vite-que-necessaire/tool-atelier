'use client';

// Aperçu HTML live d'un template : rend le HTML compilé (Handlebars + CSS, sans
// Puppeteer) dans une iframe sandboxée, mise à l'échelle pour tenir dans le
// conteneur tout en respectant le ratio du template.
type Props = {
  html: string;
  width: number;
  height: number;
  displayWidth?: number;
};

export function TemplatePreview({ html, width, height, displayWidth = 360 }: Props) {
  const scale = displayWidth / width;
  return (
    <div
      className="overflow-hidden rounded border bg-white"
      style={{ width: displayWidth, height: Math.round(height * scale) }}
    >
      <iframe
        title="Aperçu du template"
        srcDoc={html}
        sandbox=""
        scrolling="no"
        style={{
          width,
          height,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      />
    </div>
  );
}
