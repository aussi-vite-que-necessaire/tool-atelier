import { Resend } from "resend";

// Envoi transactionnel via Resend (clé + expéditeur injectés au niveau plateforme).
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "sys@avqn.ch";
  if (!apiKey) throw new Error("RESEND_API_KEY manquant");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
}
