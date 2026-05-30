import { customAlphabet } from 'nanoid';

// nanoid 12 caractères, alphabet URL-safe sans ambiguïté de casse pour les chemins.
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const generate = customAlphabet(alphabet, 12);

export function newId(): string {
  return generate();
}
