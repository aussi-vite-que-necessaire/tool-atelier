import { env } from '@/lib/env';
import { InMemoryEmailSender } from './in-memory';
import { ResendEmailSender } from './resend';
import type { EmailMessage, EmailSender } from './types';

let instance: EmailSender | undefined;

export function getEmailSender(): EmailSender {
  if (instance) return instance;
  if (env.NODE_ENV === 'test' || !env.RESEND_API_KEY) {
    instance = new InMemoryEmailSender();
  } else {
    instance = new ResendEmailSender(
      env.RESEND_API_KEY,
      env.RESEND_FROM ?? 'onboarding@resend.dev',
    );
  }
  return instance;
}

export async function sendEmail(opts: EmailMessage): Promise<void> {
  return getEmailSender().send(opts);
}
