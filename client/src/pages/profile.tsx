import { useRef, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePhotos } from "@/hooks/use-photos";
import { BottomNav } from "@/components/bottom-nav";
import WelcomePage from "./welcome";
import { Loader2, MapPin, Grid3X3, Globe, LogOut, Camera, ArrowLeft, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SortablePhotoGrid } from "@/components/sortable-photo-grid";
import { DateStamp } from "@/components/date-stamp";
import { ProfileCropModal } from "@/components/profile-crop-modal";
import type { Photo } from "@shared/schema";

function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getCountryFromPhoto(photo: Photo & { country?: string | null; locationName?: string | null }): string {
  if (photo.country) return photo.country;
  if (photo.locationName) {
    const parts = photo.locationName.split(",").map(p => p.trim());
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "Unknown";
}

interface CountryGroup {
  country: string;
  photos: (Photo & { user?: any; collection?: any })[];
  coverPhoto: Photo & { user?: any; collection?: any };
}

interface FriendProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: photos, isLoading: isLoadingPhotos } = usePhotos({ userId: user?.id });

  const { data: myFriends } = useQuery<FriendProfile[]>({
    queryKey: ["/api/users", user?.id, "friends"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user?.id}/friends`);
      if (!res.ok) throw new Error("Failed to load friends");
      return res.json();
    },
    enabled: !!user?.id,
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

  const uploadMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      await apiRequest("PATCH", "/api/auth/profile-image", { imageUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile photo updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update profile photo", variant: "destructive" });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    try {
      // Load a preview-sized version for the crop UI
      const preview = await resizeImage(file, 1200, 0.9);
      setCropImageUrl(preview);
    } catch {
      toast({ title: "Failed to load image", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(croppedDataUrl);
    } catch {
      toast({ title: "Failed to update profile photo", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setCropImageUrl(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <WelcomePage />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24">
      <div className="pt-safe px-4 pb-3">
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-lg" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-profile-photo"
              />
              <button
                onClick={handleAvatarClick}
                className="relative z-10 group cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="button-change-avatar"
                disabled={isUploading}
              >
                <Avatar className="w-14 h-14 border-2 border-white/10 shadow-2xl">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-card text-lg font-display">
                    {user.firstName?.[0] || user.username?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
            </div>
            <h2 className="text-lg font-normal tracking-tight" data-testid="text-profile-name">
              {user.firstName} {user.lastName}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground rounded-xl" data-testid="button-sign-out">
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="px-4">
        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="w-full bg-white/5 border border-white/10 p-1 rounded-xl h-12 mb-6">
            <TabsTrigger value="photos" className="flex-1 rounded-lg text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Grid3X3 className="w-3.5 h-3.5 mr-1" /> Photos
            </TabsTrigger>
            <TabsTrigger value="countries" className="flex-1 rounded-lg text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" data-testid="tab-countries">
              <Globe className="w-3.5 h-3.5 mr-1" /> Countries
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex-1 rounded-lg text-white/60 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-md transition-all" data-testid="tab-friends">
              <Users className="w-3.5 h-3.5 mr-1" /> Friends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="outline-none">
            {isLoadingPhotos ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : photos && photos.length > 0 ? (
              <SortablePhotoGrid photos={photos} />
            ) : (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Photos Yet</h3>
                <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
                  Upload photos from your adventures to see them appear here.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="countries" className="outline-none">
            {isLoadingPhotos ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : selectedCountry ? (
              <div>
                <button
                  onClick={() => setSelectedCountry(null)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-4"
                  data-testid="button-back-countries"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All Countries
                </button>
                <h3 className="text-xl font-bold font-display mb-4" data-testid="text-country-title">{selectedCountry}</h3>
                <div className="grid grid-cols-3 gap-1">
                  {countryGroups
                    .find(g => g.country === selectedCountry)
                    ?.photos.map((photo) => (
                      <div key={photo.id} className="aspect-square relative group overflow-hidden bg-white/5" data-testid={`photo-country-${photo.id}`}>
                        <img
                          src={photo.imageUrl}
                          alt="Uploaded"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <div className="text-[10px] text-white flex items-center truncate">
                            <MapPin className="w-3 h-3 mr-1 shrink-0" />
                            <span className="truncate">{photo.locationName || `${photo.latitude.toFixed(2)}, ${photo.longitude.toFixed(2)}`}</span>
                          </div>
                        </div>
                        <div className="absolute bottom-1 right-1 pointer-events-none">
                          <DateStamp date={photo.takenAt || photo.createdAt} size="sm" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : countryGroups.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {countryGroups.map((group) => (
                  <button
                    key={group.country}
                    onClick={() => setSelectedCountry(group.country)}
                    className="relative aspect-[4/3] rounded-xl overflow-hidden group"
                    data-testid={`button-country-${group.country}`}
                  >
                    <img
                      src={group.coverPhoto.imageUrl}
                      alt={group.country}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white font-medium text-sm truncate">{group.country}</p>
                      <p className="text-white/60 text-xs">{group.photos.length} photo{group.photos.length !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Countries Yet</h3>
                <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
                  Upload photos from your adventures to see them grouped by country.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="friends" className="outline-none">
            {!myFriends || myFriends.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Friends Yet</h3>
                <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
                  Search for users and add them as friends.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {myFriends.map((friend) => {
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
        </Tabs>
      </div>

      <BottomNav />

      {cropImageUrl && (
        <ProfileCropModal
          imageUrl={cropImageUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropImageUrl(null)}
          isSaving={isUploading}
        />
      )}
    </div>
  );
}
