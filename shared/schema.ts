import { pgTable, text, serial, integer, timestamp, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, sessions } from "./models/auth";

export { users, sessions };

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  takenAt: timestamp("taken_at"), 
  collectionId: integer("collection_id").references(() => collections.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Base Schemas
export const insertCollectionSchema = createInsertSchema(collections).omit({ id: true, createdAt: true, userId: true });
// For photos, we'll let the user provide imageUrl (from base64 or upload), lat, lng, takenAt.
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true, userId: true }).extend({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  collectionId: z.coerce.number().optional().nullable(),
});

// Types
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;

// API Contract Types
export type CreateCollectionRequest = InsertCollection;
export type CreatePhotoRequest = InsertPhoto;

export type PhotoResponse = Photo & { user?: typeof users.$inferSelect, collection?: Collection };
export type CollectionResponse = Collection & { photos?: Photo[] };
