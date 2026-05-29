"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { previewTemplateHtmlAction } from "../actions";

interface Props {
  templateId: string;
  vars: Record<string, unknown>;
  width: number;
  height: number;
}

// Aperçu HTML live d'un template : compile le HTML côté serveur (Handlebars +
// marque, sans Chromium) et l'affiche dans une iframe sandboxée, rendue aux
// dimensions natives du template puis mise à l'échelle pour tenir dans son
// conteneur. Debounce les changements de variables pour ne pas spammer l'action.
// Composant autonome, réutilisable hors de la modal.
export function TemplateLivePreview({ templateId, vars, width, height }: Props) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const varsKey = JSON.stringify(vars);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await previewTemplateHtmlAction(templateId, vars);
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
        setHtml(res.html ?? "");
      }
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // varsKey capture le contenu de vars ; templateId change au changement de template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, varsKey]);

  // Mise à l'échelle pour faire tenir le rendu natif (width×height) dans la boîte.
  useLayoutEffect(() => {
    function fit() {
      const box = boxRef.current;
      if (!box) return;
      const avail = box.clientWidth;
      setScale(avail > 0 ? Math.min(1, avail / width) : 1);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Aperçu · {width}×{height}
        </span>
        {loading && <span className="text-gray-400">Mise à jour…</span>}
      </div>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <div
          ref={boxRef}
          className="overflow-hidden rounded border border-gray-200 bg-gray-50"
          style={{ height: height * scale }}
        >
          <iframe
            title="Aperçu du template"
            sandbox=""
            srcDoc={html}
            scrolling="no"
            style={{
              width,
              height,
              border: "0",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      )}
    </div>
  );
}
