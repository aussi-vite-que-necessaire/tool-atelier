import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

// Toujours dynamique : dépend de la base + des cookies au runtime.
export const dynamic = 'force-dynamic';

// Monte toutes les routes BetterAuth sous /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
