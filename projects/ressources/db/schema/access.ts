import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core"
import { resources } from "./content"
import { operators } from "./operators"

// Membre d'audience rattaché à un opérateur (ADR-0002). Créé/assuré à la 1ʳᵉ
// lecture d'une ressource de l'opérateur. userId = id auth (text, sans FK locale).
export const audienceMembers = pgTable(
  "audience_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("audience_operator_user").on(t.operatorId, t.userId)],
)

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
