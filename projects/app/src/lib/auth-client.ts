'use client';

import { createAuthClient } from 'better-auth/react';

// Client BetterAuth : pointe sur l'origine courante (auth in-app, même origine
// que le reste de la suite). Pas de baseURL explicite → le navigateur résout
// /api/auth sur l'origine en cours.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
