import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { resources, pages } from "./content"
import { user } from "./auth"

export const viewEvents = pgTable(
  "view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("view_events_resource_created").on(t.resourceId, t.createdAt)],
)
