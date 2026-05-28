import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY
const from = process.env.RESEND_FROM_EMAIL

function otpHtml(code: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#000000">
  <h1 style="font-size:22px;font-weight:800">Votre code d'accès</h1>
  <p>Saisissez ce code pour accéder à votre ressource :</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:6px">${code}</p>
  <p style="color:#666666">Ce code expire dans 10 minutes.</p>
</div>`
}

export async function sendOtpEmail({ to, code }: { to: string; code: string }) {
  if (!apiKey || !from) {
    // Resend non configuré (dev/test) : on logge le code côté serveur.
    console.log(`[OTP] ${to} -> ${code}`)
    return
  }
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Votre code d'accès",
    html: otpHtml(code),
    text: `Votre code d'accès : ${code} (expire dans 10 minutes).`,
  })
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`)
}
