import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

// Clé AES-256 dérivée déterministiquement de TOKEN_ENCRYPTION_KEY (32 octets,
// quel que soit le format/longueur de la valeur env).
function key(): Buffer {
  return createHash('sha256')
    .update(env.TOKEN_ENCRYPTION_KEY ?? '')
    .digest();
}

// Chiffre un token. Retourne base64(iv(12) ‖ authTag(16) ‖ ciphertext).
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(blob: string): string {
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
