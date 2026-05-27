import { eq } from "drizzle-orm"
import { db } from "./index"
import { user } from "./schema"

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error("Usage: npm run db:make-admin -- <email>")
    process.exit(1)
  }

  const res = await db.update(user).set({ isAdmin: true }).where(eq(user.email, email.toLowerCase())).returning()
  if (res.length === 0) {
    console.error(`Aucun utilisateur avec l'email ${email} (il doit s'être connecté au moins une fois).`)
  } else {
    console.log(`Admin activé pour ${email}.`)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
