import { db } from "./server/db.js";
import { collections, photos } from "./shared/schema.js";

async function seed() {
  const existing = await db.select().from(collections);
  if (existing.length === 0) {
    console.log("Seeding database...");
    const [collection] = await db.insert(collections).values({
      name: "Iceland Trip",
      description: "Amazing trip to the land of fire and ice.",
      userId: "dummy-user-123"
    }).returning();

    await db.insert(photos).values([
      {
        userId: "dummy-user-123",
        collectionId: collection.id,
        imageUrl: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&auto=format&fit=crop",
        latitude: 64.9631,
        longitude: -19.0208,
        takenAt: new Date("2023-08-15T10:00:00Z")
      },
      {
        userId: "dummy-user-123",
        collectionId: collection.id,
        imageUrl: "https://images.unsplash.com/photo-1520681277155-001ce8677eb9?w=800&auto=format&fit=crop",
        latitude: 63.8792,
        longitude: -22.4358,
        takenAt: new Date("2023-08-16T14:30:00Z")
      },
      {
        userId: "dummy-user-456",
        imageUrl: "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&auto=format&fit=crop",
        latitude: -13.1631,
        longitude: -72.5450,
        takenAt: new Date("2022-05-20T09:15:00Z")
      } // Machu Picchu
    ]);
    console.log("Seeding complete!");
  } else {
    console.log("Database already seeded.");
  }
  process.exit(0);
}

seed().catch(console.error);