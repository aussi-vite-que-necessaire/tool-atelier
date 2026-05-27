import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { media } from './media';

export const carouselSlides = pgTable(
  'carousel_slides',
  {
    id: text('id').primaryKey(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    slideKey: text('slide_key').notNull(),
  },
  (t) => [index('carousel_slides_media_id_idx').on(t.mediaId)],
);

export type CarouselSlide = typeof carouselSlides.$inferSelect;
