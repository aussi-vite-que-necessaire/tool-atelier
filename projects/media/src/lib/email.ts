import { Resend } from "resend";

// Email transactionnel du code OTP de connexion (Resend, clé + expéditeur injectés au niveau
// plateforme). Sans clé Resend (dev/test), le code est loggé côté serveur.
function otpHtml(code: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#000000">
  <h1 style="font-size:22px;font-weight:800">Votre code d'accès</h1>
  <p>Saisissez ce code pour vous connecter à media :</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px">${code}</p>
  <p style="color:#666666">Ce code expire dans 10 minutes.</p>
</div>`;
}

export async function sendOtpEmail({ to, code }: { to: string; code: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "sys@avqn.ch";
  if (!apiKey) {
    // Resend non configuré (dev/test) : on logge le code côté serveur.
    console.log(`[OTP] ${to} -> ${code}`);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Votre code d'accès",
    html: otpHtml(code),
    text: `Votre code d'accès : ${code} (expire dans 10 minutes).`,
  });
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
}
