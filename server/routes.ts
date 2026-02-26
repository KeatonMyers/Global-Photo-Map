import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication middleware and routes
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.photos.list.path, async (req, res) => {
    try {
      const filters = api.photos.list.input ? api.photos.list.input.parse(req.query) : undefined;
      const photos = await storage.getPhotos(filters);
      res.json(photos);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  app.post(api.photos.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.photos.create.input.parse(req.body);
      const userId = req.user.claims.sub;
      const photo = await storage.createPhoto(userId, input);
      
      const fullPhoto = await storage.getPhoto(photo.id);
      res.status(201).json(fullPhoto);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create photo" });
    }
  });

  app.get(api.photos.get.path, async (req, res) => {
    const photo = await storage.getPhoto(Number(req.params.id));
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
    res.json(photo);
  });

  app.delete(api.photos.delete.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const success = await storage.deletePhoto(Number(req.params.id), userId);
    if (!success) return res.status(404).json({ message: "Photo not found or unauthorized" });
    res.status(204).end();
  });

  app.get(api.collections.list.path, async (req, res) => {
    try {
      const filters = api.collections.list.input ? api.collections.list.input.parse(req.query) : undefined;
      const colls = await storage.getCollections(filters?.userId);
      res.json(colls);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.post(api.collections.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.collections.create.input.parse(req.body);
      const userId = req.user.claims.sub;
      const collection = await storage.createCollection(userId, input);
      res.status(201).json(collection);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.get(api.collections.get.path, async (req, res) => {
    const collection = await storage.getCollection(Number(req.params.id));
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    res.json(collection);
  });

  app.get("/api/feed", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const offset = Number(req.query.offset) || 0;
      const feedPhotos = await storage.getFeedPhotos(limit, offset);
      res.json(feedPhotos);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.patch("/api/photos/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        photoIds: z.array(z.number()),
      });
      const { photoIds } = schema.parse(req.body);
      const userId = req.user.claims.sub;
      await storage.reorderPhotos(userId, photoIds);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to reorder photos" });
    }
  });

  app.get("/api/users/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (q.length === 0) return res.json([]);
      const results = await storage.searchUsers(q);
      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUserWithPhotoCount(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/auth/profile-image", isAuthenticated, async (req: any, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ message: "imageUrl is required" });
      }
      if (!imageUrl.startsWith("data:image/")) {
        return res.status(400).json({ message: "Invalid image format" });
      }
      const maxSizeBytes = 500 * 1024;
      const base64Data = imageUrl.split(",")[1] || "";
      const sizeBytes = Math.ceil(base64Data.length * 0.75);
      if (sizeBytes > maxSizeBytes) {
        return res.status(400).json({ message: "Image too large. Maximum size is 500KB." });
      }
      const userId = req.user.claims.sub;
      await storage.updateUserProfileImage(userId, imageUrl);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  return httpServer;
}
