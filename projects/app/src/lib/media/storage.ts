import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from './config';

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  const r2 = config.r2();
  _client = new S3Client({
    region: 'auto',
    endpoint: r2.endpoint,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
  return _client;
}

// Clé complète avec préfixe d'environnement (isole les écritures de preview).
export function objectKey(id: string, ext: string): string {
  return `${config.keyPrefix()}images/${id}.${ext}`;
}

export async function putImage(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const r2 = config.r2();
  await client().send(
    new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: bytes, ContentType: contentType }),
  );
}

export function publicUrl(key: string): string {
  return `${config.r2().publicBaseUrl.replace(/\/$/, '')}/${key}`;
}

export interface FetchedObject {
  bytes: Uint8Array;
  contentType: string;
}

export async function getImageBytes(key: string): Promise<FetchedObject | null> {
  const r2 = config.r2();
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    const bytes = new Uint8Array(await res.Body!.transformToByteArray());
    return { bytes, contentType: res.ContentType ?? 'image/png' };
  } catch (e) {
    if ((e as { name?: string }).name === 'NoSuchKey') return null;
    throw e;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const r2 = config.r2();
  await client().send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
}
