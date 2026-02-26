import { useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import WelcomePage from "./welcome";
import { Loader2, MapPin, Calendar, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { PhotoResponse } from "@shared/schema";

const PAGE_SIZE = 20;

async function fetchFeedPage({ pageParam = 0 }): Promise<PhotoResponse[]> {
  const res = await fetch(`/api/feed?limit=${PAGE_SIZE}&offset=${pageParam}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

function FeedCard({ photo }: { photo: PhotoResponse }) {
  const userName =
    photo.user?.firstName && photo.user?.lastName
      ? `${photo.user.firstName} ${photo.user.lastName}`
      : photo.user?.firstName || "Unknown";

  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden" data-testid={`feed-card-${photo.id}`}>
      <div className="flex items-center gap-3 p-3">
        <Avatar className="w-9 h-9 border border-white/20">
          <AvatarImage src={photo.user?.profileImageUrl || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white text-sm truncate" data-testid={`feed-username-${photo.id}`}>
            {userName}
          </div>
          {photo.locationName && (
            <div className="flex items-center gap-1 text-white/50 text-xs truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{photo.locationName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full bg-black/30">
        <img
          src={photo.imageUrl}
          alt={photo.locationName || "Photo"}
          className="w-full object-contain max-h-[600px]"
          loading="lazy"
          data-testid={`feed-image-${photo.id}`}
        />
      </div>

      <div className="p-3 flex items-center gap-2">
        {photo.locationName && (
          <span className="text-white/80 text-sm font-medium truncate" data-testid={`feed-location-${photo.id}`}>
            {photo.locationName}
          </span>
        )}
        <span className="text-white/30 text-sm">·</span>
        {photo.takenAt ? (
          <span className="text-white/40 text-xs shrink-0 flex items-center gap-1" data-testid={`feed-date-${photo.id}`}>
            <Calendar className="w-3 h-3" />
            {format(new Date(photo.takenAt), "MMM d, yyyy")}
          </span>
        ) : photo.createdAt ? (
          <span className="text-white/40 text-xs shrink-0 flex items-center gap-1" data-testid={`feed-date-${photo.id}`}>
            <Calendar className="w-3 h-3" />
            {format(new Date(photo.createdAt), "MMM d, yyyy")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function Feed() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const handlePhotoUploaded = (_lat: number, _lng: number, _imageUrl: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["/api/feed"],
    queryFn: fetchFeedPage,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: isAuthenticated,
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasNextPage || isFetchingNextPage) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) fetchNextPage();
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <WelcomePage />;
  }

  const allPhotos = data?.pages.flat() ?? [];

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white" data-testid="feed-title">Feed</h1>
        </div>
      </div>

      <div className="px-4 pt-3 pb-28 space-y-4" data-testid="feed-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <AlertCircle className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Something went wrong</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium"
              data-testid="button-retry-feed"
            >
              Try again
            </button>
          </div>
        ) : allPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <MapPin className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No photos yet</p>
            <p className="text-sm mt-1">Upload your first photo to see it here!</p>
          </div>
        ) : (
          <>
            {allPhotos.map((photo) => (
              <FeedCard key={photo.id} photo={photo} />
            ))}
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav onPhotoUploaded={handlePhotoUploaded} />
    </div>
  );
}
