import puppeteer, { type ScreenshotOptions } from 'puppeteer-core';
import { config } from './config';
import { mimeForFormat, type RenderFormat } from './image-meta';
import { isBlockedUrl } from './url-guard';

export interface RenderOptions {
  html: string;
  width: number;
  height: number;
  format?: RenderFormat; // défaut "png"
  quality?: number; // 1-100, ignoré pour png
  waitFor?: string | number; // sélecteur CSS à attendre, ou délai en ms
}

const MAX_WAIT_MS = 15000;

// Rend un HTML autonome en image via le Chromium partagé (browserless, CDP WebSocket).
// L'agent appelant fournit tout le HTML/CSS ; aucun templating ici.
export async function renderHtml(
  opts: RenderOptions,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const format: RenderFormat = opts.format ?? 'png';
  const browser = await puppeteer.connect({ browserWSEndpoint: config.browserUrl() });
  try {
    const page = await browser.newPage();

    // Garde anti-SSRF : bloque les requêtes sortantes vers des cibles internes
    // ou des schémas non-réseau (file:, etc.). Les CDN publics restent autorisés.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (isBlockedUrl(req.url())) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    await page.setViewport({ width: opts.width, height: opts.height });
    await page.setContent(opts.html, { waitUntil: 'load' });
    // Attendre que les polices web (CSS @font-face / CDN) soient prêtes avant le
    // screenshot, sinon le rendu typographique peut capturer une police de repli.
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    if (typeof opts.waitFor === 'number') {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(opts.waitFor as number, MAX_WAIT_MS)),
      );
    } else if (typeof opts.waitFor === 'string') {
      await page.waitForSelector(opts.waitFor, { timeout: MAX_WAIT_MS });
    }

    const shot: ScreenshotOptions = {
      type: format,
      clip: { x: 0, y: 0, width: opts.width, height: opts.height },
    };
    if (format !== 'png' && opts.quality !== undefined) {
      shot.quality = opts.quality;
    }

    const buffer = await page.screenshot(shot);
    return {
      bytes: new Uint8Array(buffer),
      mimeType: mimeForFormat(format),
    };
  } finally {
    // On se déconnecte du navigateur partagé (sans le fermer).
    await browser.disconnect();
  }
}
