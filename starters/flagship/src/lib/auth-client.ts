"use client";

import { createAuthClient } from "better-auth/react";

// Client navigateur : appelle les routes montées sous /api/auth.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
