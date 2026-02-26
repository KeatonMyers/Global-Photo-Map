import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PhotoResponse, type CreatePhotoRequest } from "@shared/routes";

export function usePhotos(params?: { userId?: string; collectionId?: string; bounds?: string }) {
  return useQuery({
    queryKey: [api.photos.list.path, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.userId) searchParams.set("userId", params.userId);
      if (params?.collectionId) searchParams.set("collectionId", params.collectionId);
      if (params?.bounds) searchParams.set("bounds", params.bounds);
      
      const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
      const res = await fetch(`${api.photos.list.path}${queryString}`, { credentials: "include" });
      
      if (!res.ok) throw new Error("Failed to fetch photos");
      const data = await res.json();
      return api.photos.list.responses[200].parse(data);
    },
  });
}

export function usePhoto(id: number) {
  return useQuery({
    queryKey: [api.photos.get.path, id],
    queryFn: async () => {
      const url = api.photos.get.path.replace(":id", id.toString());
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch photo");
      
      const data = await res.json();
      return api.photos.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}

export function useCreatePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePhotoRequest) => {
      // Validate input before sending
      const validated = api.photos.create.input.parse(data);
      
      const res = await fetch(api.photos.create.path, {
        method: api.photos.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload photo");
      }
      
      return api.photos.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.photos.list.path], exact: false });
      queryClient.invalidateQueries({ queryKey: [api.collections.list.path], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = api.photos.delete.path.replace(":id", id.toString());
      const res = await fetch(url, { 
        method: api.photos.delete.method,
        credentials: "include" 
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete photo");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.photos.list.path] });
    },
  });
}
