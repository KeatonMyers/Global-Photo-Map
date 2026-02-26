import { collections, photos, type Collection, type InsertCollection, type Photo, type InsertPhoto, users } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Collections
  getCollections(userId?: string): Promise<Collection[]>;
  getCollection(id: number): Promise<Collection | undefined>;
  createCollection(userId: string, collection: InsertCollection): Promise<Collection>;

  // Photos
  getPhotos(filters?: { userId?: string, collectionId?: string, bounds?: string }): Promise<(Photo & { user?: any, collection?: any })[]>;
  getPhoto(id: number): Promise<(Photo & { user?: any, collection?: any }) | undefined>;
  createPhoto(userId: string, photo: InsertPhoto): Promise<Photo>;
  deletePhoto(id: number, userId: string): Promise<boolean>;

  // Users
  updateUserProfileImage(userId: string, imageUrl: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCollections(userId?: string): Promise<Collection[]> {
    if (userId) {
      return await db.select().from(collections).where(eq(collections.userId, userId));
    }
    return await db.select().from(collections);
  }

  async getCollection(id: number): Promise<Collection | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    return collection;
  }

  async createCollection(userId: string, collection: InsertCollection): Promise<Collection> {
    const [newCollection] = await db.insert(collections).values({ ...collection, userId }).returning();
    return newCollection;
  }

  async getPhotos(filters?: { userId?: string, collectionId?: string, bounds?: string }): Promise<(Photo & { user?: any, collection?: any })[]> {
    let query = db.select({
      photo: photos,
      user: users,
      collection: collections,
    }).from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .leftJoin(collections, eq(photos.collectionId, collections.id));

    const results = await query;
    let filtered = results;
    
    if (filters?.userId) {
      filtered = filtered.filter(r => r.photo.userId === filters.userId);
    }
    if (filters?.collectionId) {
      filtered = filtered.filter(r => r.photo.collectionId === Number(filters.collectionId));
    }

    return filtered.map(r => ({
      ...r.photo,
      user: r.user || undefined,
      collection: r.collection || undefined,
    }));
  }

  async getPhoto(id: number): Promise<(Photo & { user?: any, collection?: any }) | undefined> {
    const results = await db.select({
      photo: photos,
      user: users,
      collection: collections,
    }).from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .leftJoin(collections, eq(photos.collectionId, collections.id))
      .where(eq(photos.id, id));
    
    if (results.length === 0) return undefined;

    return {
      ...results[0].photo,
      user: results[0].user || undefined,
      collection: results[0].collection || undefined,
    };
  }

  async createPhoto(userId: string, photo: InsertPhoto): Promise<Photo> {
    const [newPhoto] = await db.insert(photos).values({ ...photo, userId }).returning();
    return newPhoto;
  }

  async deletePhoto(id: number, userId: string): Promise<boolean> {
    const [deleted] = await db.delete(photos).where(
      and(eq(photos.id, id), eq(photos.userId, userId))
    ).returning();
    return !!deleted;
  }

  async updateUserProfileImage(userId: string, imageUrl: string): Promise<void> {
    await db.update(users).set({ profileImageUrl: imageUrl, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async backfillPhotoCountries(): Promise<void> {
    const allPhotos = await db.select().from(photos);
    for (const photo of allPhotos) {
      if (photo.country) continue;
      if (photo.locationName) {
        const parts = photo.locationName.split(",").map(p => p.trim());
        const country = parts[parts.length - 1] || null;
        if (country) {
          await db.update(photos).set({ country }).where(eq(photos.id, photo.id));
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
