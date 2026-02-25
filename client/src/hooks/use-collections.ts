import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CollectionResponse, type CreateCollectionRequest } from "@shared/routes";

export function useCollections(userId?: string) {
  return useQuery({
    queryKey: [api.collections.list.path, userId],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (userId) searchParams.set("userId", userId);
      
      const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
      const res = await fetch(`${api.collections.list.path}${queryString}`, { credentials: "include" });
      
      if (!res.ok) throw new Error("Failed to fetch collections");
      const data = await res.json();
      return api.collections.list.responses[200].parse(data);
    },
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCollectionRequest) => {
      const validated = api.collections.create.input.parse(data);
      
      const res = await fetch(api.collections.create.path, {
        method: api.collections.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create collection");
      }
      
      return api.collections.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.collections.list.path] });
    },
  });
}
