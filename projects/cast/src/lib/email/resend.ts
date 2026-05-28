import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from './types';

export class ResendEmailSender implements EmailSender {
  private resend: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.resend = new Resend(apiKey);
  }
  async send(opts: EmailMessage): Promise<void> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  }
}
