import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { ProfilePhotoViewer } from "@/components/profile-photo-viewer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, MapPin, Globe, UserPlus, UserCheck, Map as MapIcon, Layers, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Photo } from "@shared/schema";
import { DateStamp } from "@/components/date-stamp";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  photoCount: number;
}

interface FriendProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

function getCountryFromPhoto(photo: Photo & { country?: string | null; locationName?: string | null }): string {
  if (photo.country) return photo.country;
  if (photo.locationName) {
    const parts = photo.locationName.split(",").map((p: string) => p.trim());
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "Unknown";
}

interface CountryGroup {
  country: string;
  photos: (Photo & { user?: any; collection?: any })[];
  coverPhoto: Photo & { user?: any; collection?: any };
}

const createMapMarker = (thumbnailUrl: string | null, borderColor: string = "white") => {
  const imgStyle = thumbnailUrl
    ? `background-image: url('${thumbnailUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, #3b82f6, #8b5cf6)`;
  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-marker-frame" style="border-color: ${borderColor};">
          <div class="photo-marker-img" style="${imgStyle}"></div>
        </div>
        <div class="photo-marker-tail" style="border-top-color: ${borderColor};"></div>
      </div>
    `,
    className: "custom-leaflet-icon",
    iconSize: [68, 80],
    iconAnchor: [34, 80],
  });
};

function FitBounds({ photos }: { photos: Photo[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || photos.length === 0) return;
    fitted.current = true;
    const bounds = L.latLngBounds(photos.map(p => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, [photos, map]);
  return null;
}

interface UserMapProps {
  photos: Photo[];
  myPhotos?: Photo[];
  showOverlay: boolean;
}

function UserMap({ photos, myPhotos, showOverlay }: UserMapProps) {
  const allPhotos = showOverlay && myPhotos ? [...photos, ...myPhotos] : photos;

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No photos to show on map
      </div>
    );
  }

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="w-full h-full rounded-xl"
      zoomControl={false}
      style={{ background: "#081627" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        attribution=""
      />
      <FitBounds photos={allPhotos} />
      {photos.map((photo) => (
        <Marker
          key={`user-${photo.id}`}
          position={[photo.latitude, photo.longitude]}
          icon={createMapMarker((photo as any).thumbnailUrl || null, "white")}
        />
      ))}
      {showOverlay && myPhotos?.map((photo) => (
        <Marker
          key={`my-${photo.id}`}
          position={[photo.latitude, photo.longitude]}
          icon={createMapMarker((photo as any).thumbnailUrl || null, "#222")}
        />
      ))}
    </MapContainer>
  );
}

export default function UserProfilePage() {
  const [, params] = useRoute("/user/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = params?.id;
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const { data: friendIds } = useQuery<string[]>({
    queryKey: ["/api/friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  const isFriend = friendIds?.includes(userId || "") || false;
  const isSelf = user?.id === userId;

  const addFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/map-markers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/map-markers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: photos, isLoading: photosLoading } = useQuery<(Photo & { user?: any; collection?: any })[]>({
    queryKey: ["/api/photos", { userId }],
    queryFn: async () => {
      const res = await fetch(`/api/photos?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to load photos");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: myPhotos } = useQuery<(Photo & { user?: any; collection?: any })[]>({
    queryKey: ["/api/photos", { userId: user?.id }],
    queryFn: async () => {
      const res = await fetch(`/api/photos?userId=${user?.id}`);
      if (!res.ok) throw new Error("Failed to load photos");
      return res.json();
    },
    enabled: !!user?.id && !isSelf,
  });

  const { data: userFriends } = useQuery<FriendProfile[]>({
    queryKey: ["/api/users", userId, "friends"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/friends`);
      if (!res.ok) throw new Error("Failed to load friends");
      return res.json();
    },
    enabled: !!userId,
  });

  const countryGroups = useMemo<CountryGroup[]>(() => {
    if (!photos || photos.length === 0) return [];
    const groups: Record<string, (Photo & { user?: any; collection?: any })[]> = {};
    for (const photo of photos) {
      const country = getCountryFromPhoto(photo);
      if (!groups[country]) groups[country] = [];
      groups[country].push(photo);
    }
    return Object.entries(groups)
      .map(([country, countryPhotos]) => ({
        country,
        photos: countryPhotos,
        coverPhoto: countryPhotos[0],
      }))
      .sort((a, b) => b.photos.length - a.photos.length);
  }, [photos]);

  if (profileLoading || photosLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        User not found
      </div>
    );
  }

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "User";
  const initials = (profile.firstName?.[0] || "") + (profile.lastName?.[0] || "") || "U";
  const countryPhotos = selectedCountry ? countryGroups.find(g => g.country === selectedCountry)?.photos || [] : [];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24">
      <div className="pt-safe px-4 pb-3">
        <div className="flex items-center gap-3 mt-3 mb-4">
          <button
            onClick={() => navigate("/search")}
            className="text-white/60 hover:text-white"
            data-testid="button-back-search"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar className="w-10 h-10 border border-white/10">
            <AvatarImage src={profile.profileImageUrl || undefined} />
            <AvatarFallback className="bg-white/5 text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-normal text-white truncate" data-testid="text-user-name">
              {name}
            </h1>
          </div>

          {!isSelf && user && (
            <button
              onClick={() => {
                if (isFriend) {
                  removeFriendMutation.mutate(userId!);
                } else {
                  addFriendMutation.mutate(userId!);
                }
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isFriend
                  ? "bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400"
                  : "bg-primary text-white hover:bg-primary/80"
              }`}
              data-testid="button-toggle-friend"
            >
              {isFriend ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  Friends
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <Tabs defaultValue="photos" className="px-4">
        <TabsList className="w-full bg-white/5 border border-white/10">
          <TabsTrigger value="photos" className="flex-1 data-[state=active]:bg-white/10" data-testid="tab-photos">
            <MapPin className="w-3.5 h-3.5 mr-1" /> Photos
          </TabsTrigger>
          <TabsTrigger value="countries" className="flex-1 data-[state=active]:bg-white/10" data-testid="tab-countries">
            <Globe className="w-3.5 h-3.5 mr-1" /> Countries
          </TabsTrigger>
          <TabsTrigger value="friends" className="flex-1 data-[state=active]:bg-white/10" data-testid="tab-friends">
            <Users className="w-3.5 h-3.5 mr-1" /> Friends
          </TabsTrigger>
          <TabsTrigger value="map" className="flex-1 data-[state=active]:bg-white/10" data-testid="tab-map">
            <MapIcon className="w-3.5 h-3.5 mr-1" /> Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-3">
          {!photos || photos.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              No photos yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="aspect-square relative overflow-hidden bg-white/5"
                  data-testid={`user-photo-${photo.id}`}
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.locationName || "Photo"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-1 right-1 pointer-events-none">
                    <DateStamp date={photo.takenAt || photo.createdAt} size="sm" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="countries" className="mt-3">
          {selectedCountry ? (
            <div>
              <button
                onClick={() => setSelectedCountry(null)}
                className="flex items-center gap-2 text-white/60 hover:text-white mb-3 text-sm"
                data-testid="button-back-countries"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to countries
              </button>
              <h3 className="text-white font-medium mb-3" data-testid="text-country-name">{selectedCountry}</h3>
              <div className="grid grid-cols-3 gap-0.5">
                {countryPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square relative overflow-hidden bg-white/5"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.locationName || "Photo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-1 right-1 pointer-events-none">
                      <DateStamp date={photo.takenAt || photo.createdAt} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : countryGroups.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              No countries yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {countryGroups.map((group) => (
                <button
                  key={group.country}
                  onClick={() => setSelectedCountry(group.country)}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden group"
                  data-testid={`country-card-${group.country}`}
                >
                  <img
                    src={group.coverPhoto.imageUrl}
                    alt={group.country}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white font-medium text-sm truncate">{group.country}</p>
                    <p className="text-white/60 text-xs">{group.photos.length} photo{group.photos.length !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="friends" className="mt-3">
          {!userFriends || userFriends.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              No friends yet
            </div>
          ) : (
            <div className="space-y-1">
              {userFriends.map((friend) => {
                const friendName = [friend.firstName, friend.lastName].filter(Boolean).join(" ") || "User";
                const friendInitials = (friend.firstName?.[0] || "") + (friend.lastName?.[0] || "") || "U";
                return (
                  <button
                    key={friend.id}
                    onClick={() => navigate(`/user/${friend.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                    data-testid={`friend-${friend.id}`}
                  >
                    <Avatar className="w-10 h-10 border border-white/10">
                      <AvatarImage src={friend.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-white/5 text-white text-xs font-medium">
                        {friendInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm font-normal truncate">{friendName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-3">
          <div className="relative h-[60vh] rounded-xl overflow-hidden border border-white/10">
            <UserMap
              photos={photos || []}
              myPhotos={myPhotos || []}
              showOverlay={showOverlay}
            />

            {!isSelf && (
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`absolute bottom-4 right-4 z-[1000] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all shadow-lg ${
                  showOverlay
                    ? "bg-primary text-white"
                    : "bg-black/70 backdrop-blur-md text-white/80 border border-white/20"
                }`}
              >
                <Layers className="w-4 h-4" />
                Overlay Photos
              </button>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selectedPhotoIndex !== null && photos && (
        <ProfilePhotoViewer
          photos={photos}
          initialIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
