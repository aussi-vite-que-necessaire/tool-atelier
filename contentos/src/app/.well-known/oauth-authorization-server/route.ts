import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth/server';

export const GET = oAuthDiscoveryMetadata(auth);
