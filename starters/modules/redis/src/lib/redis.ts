import Redis from "ioredis";

// Connexion paresseuse : REDIS_URL/REDIS_PREFIX injectés au runtime par la plateforme.
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL manquant");
  _redis = new Redis(url);
  return _redis;
}

// Préfixe les clés par projet/env (REDIS_PREFIX = "<projet>:<env>:").
export function key(name: string): string {
  return `${process.env.REDIS_PREFIX ?? ""}${name}`;
}
