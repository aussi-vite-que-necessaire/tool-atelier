import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core"
import { resources } from "./content"

export const resourceAccess = pgTable(
  "resource_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("resource_access_resource_email").on(t.resourceId, t.email)],
)

// userId : ID utilisateur frappé par auth.contentos.ch. Pas de FK locale (le
// user vit dans le projet auth, base séparée). On garde le text et l'unicité.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("subscriptions_user_resource").on(t.userId, t.resourceId)],
)
