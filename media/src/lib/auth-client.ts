"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Client navigateur : appelle les routes montées sous /api/auth (connexion par code OTP email).
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });

export const { signIn, signOut, useSession } = authClient;
