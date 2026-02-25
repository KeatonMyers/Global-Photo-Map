import { useState, useRef } from "react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerHeader, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCreatePhoto } from "@/hooks/use-photos";
import { useCollections, useCreateCollection } from "@/hooks/use-collections";
import { useAuth } from "@/hooks/use-auth";
import { ImagePlus, MapPin, Calendar, Loader2, Plus, Check } from "lucide-react";
import { format } from "date-fns";
import exifr from "exifr";

interface UploadDrawerProps {
  children: React.ReactNode;
}

export function UploadDrawer({ children }: UploadDrawerProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [takenAt, setTakenAt] = useState<Date | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const createPhoto = useCreatePhoto();
  const collectionsQuery = useCollections(user?.id);
  const createCollection = useCreateCollection();

  const resetState = () => {
    setFile(null);
    setPreviewUrl(null);
    setBase64Image(null);
    setLocation(null);
    setTakenAt(null);
    setCollectionId(null);
    setIsCreatingCollection(false);
    setNewCollectionName("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(resetState, 300);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsExtracting(true);

    try {
      // Create preview & base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        setBase64Image(result);
      };
      reader.readAsDataURL(selected);

      // Extract EXIF data
      const exifData = await exifr.parse(selected);
      
      let lat = null;
      let lng = null;
      let date = null;

      if (exifData) {
        if (exifData.latitude && exifData.longitude) {
          lat = exifData.latitude;
          lng = exifData.longitude;
        }
        if (exifData.DateTimeOriginal) {
          date = new Date(exifData.DateTimeOriginal);
        }
      }

      if (lat && lng) {
        setLocation({ lat, lng });
      } else {
        toast({
          title: "No Location Data",
          description: "This photo doesn't have GPS coordinates. Map placement will be unavailable.",
          variant: "destructive",
        });
      }

      if (date) {
        setTakenAt(date);
      } else {
        setTakenAt(new Date(selected.lastModified));
      }

    } catch (err) {
      console.error("Error reading EXIF:", err);
      toast({
        title: "Error reading photo",
        description: "Could not read metadata from this image.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const col = await createCollection.mutateAsync({
        name: newCollectionName.trim(),
        description: "",
      });
      setCollectionId(col.id);
      setIsCreatingCollection(false);
      setNewCollectionName("");
      toast({ title: "Collection created!" });
    } catch (err) {
      toast({
        title: "Failed to create collection",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!base64Image || !location) {
      toast({
        title: "Missing data",
        description: "A photo with location data is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPhoto.mutateAsync({
        imageUrl: base64Image,
        latitude: location.lat,
        longitude: location.lng,
        takenAt: takenAt || new Date(),
        collectionId: collectionId,
      });

      toast({
        title: "Photo added!",
        description: "Your photo has been placed on the map.",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload photo",
        variant: "destructive",
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="bg-card/95 backdrop-blur-2xl border-white/10 text-foreground max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-display">Add to Map</DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            Upload a photo with location data to pin it on the world map.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto pb-safe">
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ImagePlus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Select Photo</h3>
              <p className="text-sm text-muted-foreground text-center">
                Requires image with GPS metadata<br/>(usually taken on a smartphone)
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                <img 
                  src={previewUrl!} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                  <div className="w-full flex justify-between items-end">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm font-medium text-white/90">
                        <MapPin className="w-4 h-4 mr-1 text-primary" />
                        {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'No Location Data'}
                      </div>
                      <div className="flex items-center text-sm text-white/70">
                        <Calendar className="w-4 h-4 mr-1" />
                        {takenAt ? format(takenAt, 'PPP p') : 'Unknown Date'}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
                      onClick={() => setFile(null)}
                    >
                      Change
                    </Button>
                  </div>
                </div>
                
                {isExtracting && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              {location ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Add to Trip / Collection (Optional)</Label>
                    
                    {isCreatingCollection ? (
                      <div className="flex gap-2">
                        <Input 
                          placeholder="E.g., Summer in Italy 2024" 
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          className="bg-white/5 border-white/10 focus-visible:ring-primary/50"
                          autoFocus
                        />
                        <Button 
                          onClick={handleCreateCollection}
                          disabled={!newCollectionName.trim() || createCollection.isPending}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          {createCollection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => setIsCreatingCollection(false)}
                          className="text-muted-foreground hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {collectionsQuery.data?.map(col => (
                          <button
                            key={col.id}
                            onClick={() => setCollectionId(col.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              collectionId === col.id 
                                ? "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            <div className="font-medium text-sm truncate">{col.name}</div>
                            <div className="text-xs opacity-60 mt-1">{col.photos?.length || 0} photos</div>
                          </button>
                        ))}
                        <button
                          onClick={() => setIsCreatingCollection(true)}
                          className="p-3 rounded-xl border border-dashed border-white/20 bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all flex flex-col items-center justify-center gap-1"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-xs font-medium">New Trip</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <Button 
                    className="w-full py-6 rounded-xl text-lg font-semibold bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                    onClick={handleUpload}
                    disabled={createPhoto.isPending}
                  >
                    {createPhoto.isPending ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Pinning to Map...</>
                    ) : (
                      <><MapPin className="w-5 h-5 mr-2" /> Pin to Map</>
                    )}
                  </Button>
                </div>
              ) : !isExtracting ? (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive-foreground p-4 rounded-xl flex items-start gap-3">
                  <div className="bg-destructive/20 p-2 rounded-full mt-0.5">
                    <MapPin className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-destructive mb-1">Missing Location Data</h4>
                    <p className="text-sm opacity-80 mb-3">
                      This photo cannot be placed on the map because it doesn't contain GPS coordinates in its metadata.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setFile(null)}
                      className="bg-transparent border-destructive/30 hover:bg-destructive/20 text-destructive"
                    >
                      Choose another photo
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DrawerContent>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg,image/png,image/heic,image/heif" 
        className="hidden" 
      />
    </Drawer>
  );
}
