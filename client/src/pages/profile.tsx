import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePhotos } from "@/hooks/use-photos";
import { useCollections } from "@/hooks/use-collections";
import { BottomNav } from "@/components/bottom-nav";
import WelcomePage from "./welcome";
import { Loader2, MapPin, Grid3X3, Layers, LogOut, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

export default function Profile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: photos, isLoading: isLoadingPhotos } = usePhotos({ userId: user?.id });
  const { data: collections, isLoading: isLoadingCollections } = useCollections(user?.id);

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
    setIsUploading(true);
    try {
      const resized = await resizeImage(file, 400, 0.85);
      await uploadMutation.mutateAsync(resized);
    } catch {
      toast({ title: "Failed to process image", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      {/* Header Profile Area */}
      <div className="pt-safe px-4 pb-6">
        <div className="flex justify-end pt-4">
          <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground hover:text-white hover:bg-white/10 rounded-xl">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
        
        <div className="flex flex-col items-center text-center mt-2">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
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
              className="relative z-10 group cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="button-change-avatar"
              disabled={isUploading}
            >
              <Avatar className="w-24 h-24 border-2 border-white/10 shadow-2xl">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="bg-card text-2xl font-display">
                  {user.firstName?.[0] || user.username?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
          </div>
          
          <h2 className="text-2xl font-bold font-display mt-4 tracking-tight">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {photos?.length || 0} Photos Pinned
          </p>
        </div>
      </div>

      <div className="px-4">
        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="w-full bg-white/5 border border-white/10 p-1 rounded-xl h-12 mb-6">
            <TabsTrigger value="photos" className="w-1/2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Grid3X3 className="w-4 h-4 mr-2" /> Photos
            </TabsTrigger>
            <TabsTrigger value="collections" className="w-1/2 rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">
              <Layers className="w-4 h-4 mr-2" /> Trips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="outline-none">
            {isLoadingPhotos ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : photos && photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="aspect-square relative group overflow-hidden bg-white/5">
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
                  </div>
                ))}
              </div>
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

          <TabsContent value="collections" className="outline-none">
            {isLoadingCollections ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : collections && collections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {collections.map((col) => (
                  <div key={col.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer">
                    <h3 className="font-semibold text-lg">{col.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {col.photos?.length || 0} items
                    </p>
                    
                    {col.photos && col.photos.length > 0 && (
                      <div className="flex mt-4 -space-x-2 overflow-hidden">
                        {col.photos.slice(0, 4).map((p, i) => (
                          <img 
                            key={p.id} 
                            className="inline-block h-10 w-10 rounded-full ring-2 ring-background object-cover" 
                            src={p.imageUrl} 
                            alt="" 
                            style={{ zIndex: 4 - i }}
                          />
                        ))}
                        {col.photos.length > 4 && (
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-background bg-white/10 text-xs font-medium z-0">
                            +{col.photos.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Trips</h3>
                <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
                  Group your photos into trips and collections when you upload them.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
