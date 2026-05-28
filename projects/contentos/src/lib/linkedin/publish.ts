import { env } from '@/lib/env';

const LINKEDIN_VERSION = env.LINKEDIN_API_VERSION;
const BASE_URL = 'https://api.linkedin.com';

export type PublishResult = { id: string; url: string };

// Média à publier. document = PDF rendu en carrousel par LinkedIn ; video = MP4.
export type PublishMedia =
  | { kind: 'image'; bytes: Buffer }
  | { kind: 'document'; bytes: Buffer; filename: string }
  | { kind: 'video'; bytes: Buffer };

export type PublishOpts = {
  content: string;
  media: PublishMedia | null;
  accessToken: string;
  authorUrn: string;
};
export type PublishFn = (opts: PublishOpts) => Promise<PublishResult>;

export type FailureKind =
  | 'token_expired'
  | 'rate_limit'
  | 'invalid_content'
  | 'platform_5xx'
  | 'network';

export class LinkedInPublishError extends Error {
  kind: FailureKind;
  constructor(message: string, kind: FailureKind) {
    super(message);
    this.name = 'LinkedInPublishError';
    this.kind = kind;
  }
}

export function classifyHttpError(status: number): FailureKind {
  if (status === 401) return 'token_expired';
  if (status === 429) return 'rate_limit';
  if (status >= 400 && status < 500) return 'invalid_content';
  return 'platform_5xx';
}

export function buildExternalUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;
}

type PostBody = {
  author: string;
  commentary: string;
  visibility: string;
  distribution: { feedDistribution: string };
  lifecycleState: string;
  isReshareDisabledByAuthor: boolean;
  content?: { media: { id: string; title?: string } };
};

export function buildPostBody(opts: {
  authorUrn: string;
  content: string;
  mediaUrn?: string;
  title?: string;
}): PostBody {
  const body: PostBody = {
    author: opts.authorUrn,
    commentary: opts.content,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED' },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (opts.mediaUrn) {
    body.content = {
      media: opts.title ? { id: opts.mediaUrn, title: opts.title } : { id: opts.mediaUrn },
    };
  }
  return body;
}

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

function failOn(res: Response, label: string): never {
  throw new LinkedInPublishError(`${label} ${res.status}`, classifyHttpError(res.status));
}

async function initUpload(
  resource: 'images' | 'documents' | 'videos',
  accessToken: string,
  authorUrn: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/rest/${resource}?action=initializeUpload`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn, ...extra } }),
  });
  if (!res.ok) failOn(res, `initializeUpload ${resource}`);
  return (await res.json()) as { value: unknown };
}

async function putBinary(
  uploadUrl: string,
  bytes: Buffer,
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) failOn(res, 'upload');
  return res.headers.get('etag');
}

// Poll le statut d'un asset document/vidéo jusqu'à AVAILABLE (traitement async).
async function pollUntilAvailable(
  resource: 'documents' | 'videos',
  urn: string,
  accessToken: string,
  timeoutMs = 45_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/rest/${resource}/${encodeURIComponent(urn)}`, {
      headers: headers(accessToken),
    });
    if (res.ok) {
      const data = (await res.json()) as { status?: string };
      if (data.status === 'AVAILABLE') return;
      if (data.status === 'PROCESSING_FAILED') {
        throw new LinkedInPublishError('traitement média échoué', 'invalid_content');
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new LinkedInPublishError('média trop long à traiter', 'platform_5xx');
}

async function postToFeed(opts: PublishOpts, mediaUrn?: string, title?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/rest/posts`, {
    method: 'POST',
    headers: headers(opts.accessToken),
    body: JSON.stringify(
      buildPostBody({ authorUrn: opts.authorUrn, content: opts.content, mediaUrn, title }),
    ),
  });
  if (!res.ok) failOn(res, 'post');
  return res.headers.get('x-restli-id') ?? `urn:li:share:${Date.now()}`;
}

async function uploadImage(opts: PublishOpts, bytes: Buffer): Promise<string> {
  const { value } = (await initUpload('images', opts.accessToken, opts.authorUrn)) as {
    value: { uploadUrl: string; image: string };
  };
  await putBinary(value.uploadUrl, bytes, opts.accessToken);
  return value.image;
}

async function uploadDocument(opts: PublishOpts, bytes: Buffer): Promise<string> {
  const { value } = (await initUpload('documents', opts.accessToken, opts.authorUrn)) as {
    value: { uploadUrl: string; document: string };
  };
  await putBinary(value.uploadUrl, bytes, opts.accessToken);
  await pollUntilAvailable('documents', value.document, opts.accessToken);
  return value.document;
}

async function uploadVideo(opts: PublishOpts, bytes: Buffer): Promise<string> {
  const { value } = (await initUpload('videos', opts.accessToken, opts.authorUrn, {
    fileSizeBytes: bytes.length,
    uploadCaptions: false,
    uploadThumbnail: false,
  })) as {
    value: {
      video: string;
      uploadToken: string;
      uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[];
    };
  };
  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
    const etag = await putBinary(part.uploadUrl, chunk, opts.accessToken);
    if (etag) etags.push(etag);
  }
  const finRes = await fetch(`${BASE_URL}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: headers(opts.accessToken),
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: value.video,
        uploadToken: value.uploadToken,
        uploadedPartIds: etags,
      },
    }),
  });
  if (!finRes.ok) failOn(finRes, 'finalizeUpload video');
  await pollUntilAvailable('videos', value.video, opts.accessToken);
  return value.video;
}

export const publishReal: PublishFn = async (opts) => {
  try {
    let mediaUrn: string | undefined;
    let title: string | undefined;
    if (opts.media?.kind === 'image') {
      mediaUrn = await uploadImage(opts, opts.media.bytes);
    } else if (opts.media?.kind === 'document') {
      mediaUrn = await uploadDocument(opts, opts.media.bytes);
      title = opts.media.filename;
    } else if (opts.media?.kind === 'video') {
      mediaUrn = await uploadVideo(opts, opts.media.bytes);
    }
    const urn = await postToFeed(opts, mediaUrn, title);
    return { id: urn, url: buildExternalUrl(urn) };
  } catch (err) {
    if (err instanceof LinkedInPublishError) throw err;
    throw new LinkedInPublishError(
      `réseau : ${err instanceof Error ? err.message : String(err)}`,
      'network',
    );
  }
};

export const publishStub: PublishFn = async () => {
  const rand = Math.random().toString(36).slice(2, 10);
  const urn = `urn:li:share:stub-${rand}`;
  await new Promise((r) => setTimeout(r, 300));
  return { id: urn, url: buildExternalUrl(urn) };
};

export const publish: PublishFn = env.CONTENT_OS_LINKEDIN_STUB === '1' ? publishStub : publishReal;
