import type { EmailMessage, EmailSender } from './types';

export class InMemoryEmailSender implements EmailSender {
  private store: EmailMessage[] = [];

  async send(opts: EmailMessage): Promise<void> {
    this.store.push(opts);
  }

  inbox(to: string): EmailMessage[] {
    return this.store.filter((e) => e.to === to);
  }

  clear(): void {
    this.store = [];
  }
}
