import { env } from '@/lib/env';
import { FilesystemMediaEngine } from './filesystem';
import { HttpMediaEngine } from './http';
import { InMemoryMediaEngine } from './in-memory';
import type { MediaEngine } from './types';

export type { MediaEngine, MediaObject } from './types';

// Singletons partagés dans le process pour que les opérations successives
// (generate puis download) fonctionnent dans la même session.
let _inMemoryStub: InMemoryMediaEngine | undefined;
let _fsStub: FilesystemMediaEngine | undefined;

export function getMediaEngine(): MediaEngine {
  if (env.CONTENT_OS_MEDIA_STUB === 'fs') {
    if (!_fsStub) _fsStub = new FilesystemMediaEngine();
    return _fsStub;
  }
  if (env.CONTENT_OS_MEDIA_STUB === '1') {
    if (!_inMemoryStub) _inMemoryStub = new InMemoryMediaEngine();
    return _inMemoryStub;
  }
  return new HttpMediaEngine({
    baseUrl: env.MEDIA_ENGINE_URL ?? '',
    serviceKey: env.MEDIA_ENGINE_SERVICE_KEY ?? '',
  });
}
