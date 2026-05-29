import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

// Profil opérateur, local à ressources (ADR-0002 : tenancy locale à l'outil).
// id = user.id frappé par auth.contentos.ch (pas de FK locale, le user vit dans
// la base auth). La présence d'une ligne ici EST la porte « opérateur » de
// ressources (cf. lib/auth/operator.ts). handle = slug de l'espace public
// partageable (/o/<handle>).
export const operators = pgTable("operators", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorRow = typeof operators.$inferSelect
