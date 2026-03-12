import { useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import WelcomePage from "./welcome";
import { Loader2, MapPin, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { PhotoResponse } from "@shared/schema";
import { PinchZoomImage } from "@/components/pinch-zoom-image";
import { DateStamp } from "@/components/date-stamp";

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
    <div className="relative w-full" data-testid={`feed-card-${photo.id}`}>
      <PinchZoomImage
        src={photo.imageUrl}
        alt={photo.locationName || "Photo"}
        className="relative w-full"
        imgClassName="w-full object-cover"
        data-testid={`feed-image-${photo.id}`}
      />

      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 via-black/30 to-transparent px-3 pt-3 pb-8 pointer-events-none">
        <div className="flex items-center gap-2.5">
          <Avatar className="w-9 h-9 border border-white/30">
            <AvatarImage src={photo.user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm truncate drop-shadow-sm" data-testid={`feed-username-${photo.id}`}>
              {userName}
            </div>
            {photo.locationName && (
              <div className="flex items-center gap-1 text-white/80 text-[11px] truncate drop-shadow-sm">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{photo.locationName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-3 pointer-events-none" data-testid={`feed-date-${photo.id}`}>
        <DateStamp date={photo.takenAt || photo.createdAt} />
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
    <div className="h-[100dvh] bg-black text-white overflow-y-auto snap-y snap-mandatory" style={{ scrollBehavior: "smooth" }} data-testid="feed-list">
      {isLoading ? (
        <div className="h-[100dvh] flex items-center justify-center snap-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : isError ? (
        <div className="h-[100dvh] flex flex-col items-center justify-center text-white/40 snap-center">
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
        <div className="h-[100dvh] flex flex-col items-center justify-center text-white/40 snap-center">
          <MapPin className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">No photos yet</p>
          <p className="text-sm mt-1">Upload your first photo to see it here!</p>
        </div>
      ) : (
        <>
          {allPhotos.map((photo) => (
            <div key={photo.id} className="snap-center py-0.5">
              <FeedCard photo={photo} />
            </div>
          ))}
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4 snap-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
          {/* Spacer so last photo can snap to center */}
          <div className="h-24" />
        </>
      )}

      <BottomNav onPhotoUploaded={handlePhotoUploaded} />
    </div>
  );
}
