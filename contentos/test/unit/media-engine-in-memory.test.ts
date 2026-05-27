import { describe, expect, test } from 'vitest';
import { InMemoryMediaEngine } from '@/lib/media-engine/in-memory';

describe('InMemoryMediaEngine', () => {
  test('generate retourne un MediaObject avec id unique et url contenant cet id', async () => {
    const engine = new InMemoryMediaEngine();
    const obj = await engine.generate({ prompt: 'un chien', aspectRatio: '1:1' });
    expect(obj.id).toBeTruthy();
    expect(obj.url).toContain(obj.id);
    expect(obj.width).toBe(1);
    expect(obj.height).toBe(1);
  });

  test('renderHtml retourne un MediaObject avec id unique et url contenant cet id', async () => {
    const engine = new InMemoryMediaEngine();
    const obj = await engine.renderHtml({ html: '<p>hi</p>', width: 1080, height: 1080 });
    expect(obj.id).toBeTruthy();
    expect(obj.url).toContain(obj.id);
    expect(obj.width).toBe(1);
    expect(obj.height).toBe(1);
  });

  test('upload retourne un MediaObject avec id unique et url contenant cet id', async () => {
    const engine = new InMemoryMediaEngine();
    const bytes = Buffer.from('hello');
    const obj = await engine.upload({ bytes, contentType: 'image/png' });
    expect(obj.id).toBeTruthy();
    expect(obj.url).toContain(obj.id);
  });

  test('les ids générés sont uniques entre appels', async () => {
    const engine = new InMemoryMediaEngine();
    const a = await engine.generate({ prompt: 'a', aspectRatio: '1:1' });
    const b = await engine.generate({ prompt: 'b', aspectRatio: '1:1' });
    expect(a.id).not.toBe(b.id);
  });

  test('download(obj.url) retourne les bytes stockés', async () => {
    const engine = new InMemoryMediaEngine();
    const bytes = Buffer.from('data png');
    const obj = await engine.upload({ bytes, contentType: 'image/png' });
    const result = await engine.download(obj.url);
    expect(result).toEqual(bytes);
  });

  test('download(obj.id) retourne aussi les bytes stockés', async () => {
    const engine = new InMemoryMediaEngine();
    const bytes = Buffer.from('data by id');
    const obj = await engine.upload({ bytes, contentType: 'image/png' });
    const result = await engine.download(obj.id);
    expect(result).toEqual(bytes);
  });

  test('edit retourne un nouvel objet avec un id différent, la source reste téléchargeable', async () => {
    const engine = new InMemoryMediaEngine();
    const source = await engine.generate({ prompt: 'original', aspectRatio: '1:1' });
    const edited = await engine.edit({ sourceId: source.id, prompt: 'rendre bleu' });
    expect(edited.id).not.toBe(source.id);
    // la source reste accessible
    const sourceBytes = await engine.download(source.id);
    expect(sourceBytes).toBeTruthy();
    // la nouvelle version aussi
    const editedBytes = await engine.download(edited.id);
    expect(editedBytes).toBeTruthy();
  });

  test('delete(id) puis download(id) throw', async () => {
    const engine = new InMemoryMediaEngine();
    const obj = await engine.upload({ bytes: Buffer.from('x'), contentType: 'image/png' });
    await engine.delete(obj.id);
    await expect(engine.download(obj.id)).rejects.toThrow();
  });

  test('delete(id) puis download(url) throw aussi', async () => {
    const engine = new InMemoryMediaEngine();
    const obj = await engine.upload({ bytes: Buffer.from('x'), contentType: 'image/png' });
    await engine.delete(obj.id);
    await expect(engine.download(obj.url)).rejects.toThrow();
  });
});
