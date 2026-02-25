import { z } from 'zod';
import { insertPhotoSchema, insertCollectionSchema, type PhotoResponse, type CollectionResponse } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

export const api = {
  photos: {
    list: {
      method: 'GET' as const,
      path: '/api/photos' as const,
      input: z.object({
        userId: z.string().optional(),
        collectionId: z.string().optional(),
        bounds: z.string().optional(), // minLat,minLng,maxLat,maxLng
      }).optional(),
      responses: {
        200: z.array(z.custom<PhotoResponse>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/photos' as const,
      input: insertPhotoSchema,
      responses: {
        201: z.custom<PhotoResponse>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/photos/:id' as const,
      responses: {
        200: z.custom<PhotoResponse>(),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/photos/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      }
    }
  },
  collections: {
    list: {
      method: 'GET' as const,
      path: '/api/collections' as const,
      input: z.object({
        userId: z.string().optional()
      }).optional(),
      responses: {
        200: z.array(z.custom<CollectionResponse>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/collections' as const,
      input: insertCollectionSchema,
      responses: {
        201: z.custom<CollectionResponse>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/collections/:id' as const,
      responses: {
        200: z.custom<CollectionResponse>(),
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
