import { Resend } from "resend";

export type EmailMessage = { to: string; subject: string; html: string; text?: string };

// Envoi transactionnel via Resend (RESEND_API_KEY + EMAIL_FROM injectés par la
// plateforme quand lab.json email:true). Sans clé (dev/preview), logge côté serveur.
export async function sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  if (!apiKey) {
    console.log(`[email] -> ${to} : ${subject}\n${text ?? html}`);
    return;
  }
  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, html, text: text ?? "" });
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
}
