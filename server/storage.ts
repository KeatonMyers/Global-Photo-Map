import { collections, photos, type Collection, type InsertCollection, type Photo, type InsertPhoto, users, friendships } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, ilike, sql, inArray, isNull } from "drizzle-orm";
import { generateThumbnail } from "./thumbnail";

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

  // Feed
  getFeedPhotos(limit: number, offset: number): Promise<(Photo & { user?: any, collection?: any })[]>;

  // Users
  updateUserProfileImage(userId: string, imageUrl: string): Promise<void>;
  reorderPhotos(userId: string, photoIds: number[]): Promise<void>;
  searchUsers(query: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null }[]>;
  getUserWithPhotoCount(userId: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null; photoCount: number } | undefined>;

  // Friends
  addFriend(userId: string, friendId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  getFriendIds(userId: string): Promise<string[]>;
  isFriend(userId: string, friendId: string): Promise<boolean>;
  getFriendsPhotos(userId: string): Promise<(Photo & { user?: any, collection?: any })[]>;
  getFriendsFeedPhotos(userId: string, limit: number, offset: number): Promise<(Photo & { user?: any, collection?: any })[]>;

  // Map markers (lightweight, no full imageUrl)
  getFriendsMapMarkers(userId: string): Promise<{ id: number; userId: string; thumbnailUrl: string | null; latitude: number; longitude: number; locationName: string | null; country: string | null; takenAt: Date | null }[]>;

  // Thumbnail backfill
  backfillThumbnails(): Promise<number>;
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

    return filtered
      .map(r => ({
        ...r.photo,
        user: r.user || undefined,
        collection: r.collection || undefined,
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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
    let thumbnailUrl: string | null = null;
    if (photo.imageUrl && photo.imageUrl.startsWith("data:image/")) {
      try {
        thumbnailUrl = await generateThumbnail(photo.imageUrl);
      } catch (e) {
        console.error("Failed to generate thumbnail:", e);
      }
    }
    const [newPhoto] = await db.insert(photos).values({ ...photo, userId, thumbnailUrl }).returning();
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

  async reorderPhotos(userId: string, photoIds: number[]): Promise<void> {
    const userPhotos = await db.select({ id: photos.id }).from(photos).where(eq(photos.userId, userId));
    const userPhotoIds = new Set(userPhotos.map(p => p.id));
    for (const id of photoIds) {
      if (!userPhotoIds.has(id)) {
        throw new Error("Invalid photo ID in reorder request");
      }
    }
    for (let i = 0; i < photoIds.length; i++) {
      await db.update(photos)
        .set({ sortOrder: i })
        .where(and(eq(photos.id, photoIds[i]), eq(photos.userId, userId)));
    }
  }

  async getFeedPhotos(limit: number, offset: number): Promise<(Photo & { user?: any, collection?: any })[]> {
    const results = await db.select({
      photo: photos,
      user: users,
      collection: collections,
    }).from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .leftJoin(collections, eq(photos.collectionId, collections.id))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map(r => ({
      ...r.photo,
      user: r.user || undefined,
      collection: r.collection || undefined,
    }));
  }

  async searchUsers(query: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null }[]> {
    if (!query || query.trim().length === 0) return [];
    const pattern = `%${query.trim()}%`;
    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(
        or(
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(sql`COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`, pattern)
        )
      )
      .limit(20);
    return results;
  }

  async getUserWithPhotoCount(userId: string): Promise<{ id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null; photoCount: number } | undefined> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length === 0) return undefined;
    const photoCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(photos)
      .where(eq(photos.userId, userId));
    return {
      id: user[0].id,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      profileImageUrl: user[0].profileImageUrl,
      photoCount: photoCountResult[0]?.count || 0,
    };
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    const existing = await db.select().from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));
    if (existing.length > 0) return;
    await db.insert(friendships).values({ userId, friendId });
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await db.delete(friendships).where(
      and(eq(friendships.userId, userId), eq(friendships.friendId, friendId))
    );
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const rows = await db.select({ friendId: friendships.friendId })
      .from(friendships)
      .where(eq(friendships.userId, userId));
    return rows.map(r => r.friendId);
  }

  async isFriend(userId: string, friendId: string): Promise<boolean> {
    const rows = await db.select().from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));
    return rows.length > 0;
  }

  async getFriendsPhotos(userId: string): Promise<(Photo & { user?: any, collection?: any })[]> {
    const friendIds = await this.getFriendIds(userId);
    const allIds = [userId, ...friendIds];
    if (allIds.length === 0) return [];
    const results = await db.select({
      photo: photos,
      user: users,
      collection: collections,
    }).from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .leftJoin(collections, eq(photos.collectionId, collections.id))
      .where(inArray(photos.userId, allIds));
    return results.map(r => ({
      ...r.photo,
      user: r.user || undefined,
      collection: r.collection || undefined,
    }));
  }

  async getFriendsFeedPhotos(userId: string, limit: number, offset: number): Promise<(Photo & { user?: any, collection?: any })[]> {
    const friendIds = await this.getFriendIds(userId);
    const allIds = [userId, ...friendIds];
    if (allIds.length === 0) return [];
    const results = await db.select({
      photo: photos,
      user: users,
      collection: collections,
    }).from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .leftJoin(collections, eq(photos.collectionId, collections.id))
      .where(inArray(photos.userId, allIds))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);
    return results.map(r => ({
      ...r.photo,
      user: r.user || undefined,
      collection: r.collection || undefined,
    }));
  }

  async getFriendsMapMarkers(userId: string): Promise<{ id: number; userId: string; thumbnailUrl: string | null; latitude: number; longitude: number; locationName: string | null; country: string | null; takenAt: Date | null }[]> {
    const friendIds = await this.getFriendIds(userId);
    const allIds = [userId, ...friendIds];
    if (allIds.length === 0) return [];
    const results = await db.select({
      id: photos.id,
      userId: photos.userId,
      thumbnailUrl: photos.thumbnailUrl,
      latitude: photos.latitude,
      longitude: photos.longitude,
      locationName: photos.locationName,
      country: photos.country,
      takenAt: photos.takenAt,
    }).from(photos)
      .where(inArray(photos.userId, allIds));
    return results;
  }

  async backfillThumbnails(): Promise<number> {
    const photosWithoutThumbnails = await db.select({
      id: photos.id,
      imageUrl: photos.imageUrl,
    }).from(photos).where(isNull(photos.thumbnailUrl));

    let count = 0;
    for (const photo of photosWithoutThumbnails) {
      if (!photo.imageUrl.startsWith("data:image/")) continue;
      try {
        const thumbnail = await generateThumbnail(photo.imageUrl);
        await db.update(photos).set({ thumbnailUrl: thumbnail }).where(eq(photos.id, photo.id));
        count++;
      } catch (e) {
        console.error(`Failed to generate thumbnail for photo ${photo.id}:`, e);
      }
    }
    return count;
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
