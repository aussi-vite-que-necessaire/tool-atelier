import type { APIRoute } from "astro";
import { auth } from "@/lib/auth";

export const prerender = false;

// BetterAuth expose toutes ses routes REST (sign-in, sign-out, OTP, OAuth…) ici.
export const ALL: APIRoute = ({ request }) => auth.handler(request);
