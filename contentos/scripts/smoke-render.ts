#!/usr/bin/env tsx
import { closeRenderer, renderHtmlToPng } from '@/lib/visual-templates/render';

async function main() {
  const html = `<!doctype html><html><body style="background:#fa0;width:200px;height:200px;margin:0"></body></html>`;
  const obj = await renderHtmlToPng({ html, width: 200, height: 200 });
  console.log('OK', `url=${obj.url}`, `id=${obj.id}`);
  await closeRenderer();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
