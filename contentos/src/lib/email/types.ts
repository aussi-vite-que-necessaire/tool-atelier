export type EmailMessage = { to: string; subject: string; html: string };

export interface EmailSender {
  send(opts: EmailMessage): Promise<void>;
  inbox?(to: string): EmailMessage[];
  clear?(): void;
}
