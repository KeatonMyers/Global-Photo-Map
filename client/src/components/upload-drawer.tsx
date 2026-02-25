import { useState, useRef } from "react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerHeader, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCreatePhoto } from "@/hooks/use-photos";
import { useCollections, useCreateCollection } from "@/hooks/use-collections";
import { useAuth } from "@/hooks/use-auth";
import { ImagePlus, MapPin, Calendar, Loader2, Plus, Check, Search, X } from "lucide-react";
import { format } from "date-fns";
import exifr from "exifr";

interface UploadDrawerProps {
  children: React.ReactNode;
  onUploaded?: (lat: number, lng: number) => void;
}

async function resizeImage(file: File, maxPx = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxPx / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "PhotoMapApp/1.0" }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name,
  };
}

export function UploadDrawer({ children, onUploaded }: UploadDrawerProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; display?: string } | null>(null);
  const [takenAt, setTakenAt] = useState<Date | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Manual location state
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

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
    setShowLocationInput(false);
    setLocationQuery("");
    setGeocodeError(null);
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
    setLocation(null);
    setShowLocationInput(false);
    setLocationQuery("");
    setGeocodeError(null);

    try {
      // Show a quick preview at full res, but store a resized version for upload
      const previewObjectUrl = URL.createObjectURL(selected);
      setPreviewUrl(previewObjectUrl);

      // Resize to max 1200px and convert to JPEG base64 for upload
      const resized = await resizeImage(selected, 1200, 0.82);
      setBase64Image(resized);

      const exifData = await exifr.parse(selected, { gps: true, tiff: true });

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
        // No GPS — prompt for manual location instead of hard error
        setShowLocationInput(true);
      }

      setTakenAt(date ?? new Date(selected.lastModified));
    } catch (err) {
      console.error("Error reading EXIF:", err);
      setShowLocationInput(true);
      setTakenAt(new Date(selected.lastModified));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGeocode = async () => {
    const q = locationQuery.trim();
    if (!q) return;
    setIsGeocoding(true);
    setGeocodeError(null);
    try {
      const result = await geocodeLocation(q);
      if (result) {
        setLocation({ lat: result.lat, lng: result.lng, display: result.display });
        setShowLocationInput(false);
        setLocationQuery("");
      } else {
        setGeocodeError("Location not found. Try a city, zip code, or landmark.");
      }
    } catch {
      setGeocodeError("Could not look up location. Check your connection.");
    } finally {
      setIsGeocoding(false);
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
        description: "A photo with location is required.",
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
      onUploaded?.(location.lat, location.lng);
      setOpen(false);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload photo",
        variant: "destructive",
      });
    }
  };

  const hasFile = !!file && !isExtracting;
  const canUpload = hasFile && !!location && !showLocationInput;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="bg-card/95 backdrop-blur-2xl border-white/10 text-foreground max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-display">Add to Map</DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            Upload a photo to pin it anywhere on the world map.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto pb-safe space-y-5">
          {/* Step 1: File picker */}
          {!file ? (
            <div
              data-testid="upload-drop-zone"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-primary/50 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ImagePlus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Select Photo</h3>
              <p className="text-sm text-muted-foreground text-center">
                GPS metadata auto-detected.<br />You can also add location manually.
              </p>
            </div>
          ) : (
            <>
              {/* Photo preview */}
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                  <div className="w-full flex justify-between items-end">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm font-medium text-white/90">
                        <MapPin className="w-4 h-4 mr-1 text-primary flex-shrink-0" />
                        {location
                          ? (location.display
                              ? <span className="truncate max-w-[200px]">{location.display.split(",").slice(0, 2).join(", ")}</span>
                              : `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`)
                          : <span className="text-white/50">No location set</span>}
                      </div>
                      <div className="flex items-center text-sm text-white/70">
                        <Calendar className="w-4 h-4 mr-1" />
                        {takenAt ? format(takenAt, 'PPP') : 'Unknown Date'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/20 text-white backdrop-blur-md"
                      onClick={() => { setFile(null); resetState(); }}
                      data-testid="button-change-photo"
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

              {/* Location section — appears when no EXIF GPS */}
              {!isExtracting && (
                <div className="space-y-3">
                  {/* Already have location but allow changing it */}
                  {location && !showLocationInput && (
                    <button
                      onClick={() => { setShowLocationInput(true); setGeocodeError(null); }}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
                      data-testid="button-change-location"
                    >
                      <MapPin className="w-3 h-3" />
                      Change location
                    </button>
                  )}

                  {/* Manual location input */}
                  {showLocationInput && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {location ? "Change Location" : "Add Location"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Enter a zip code, city, or landmark
                          </p>
                        </div>
                        {location && (
                          <button
                            onClick={() => { setShowLocationInput(false); setGeocodeError(null); }}
                            className="text-muted-foreground hover:text-white transition-colors"
                            data-testid="button-cancel-location"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          data-testid="input-location-search"
                          placeholder="e.g. 10001, Paris, Times Square…"
                          value={locationQuery}
                          onChange={(e) => { setLocationQuery(e.target.value); setGeocodeError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && handleGeocode()}
                          className="bg-white/5 border-white/10 focus-visible:ring-primary/50 flex-1"
                          autoFocus
                        />
                        <Button
                          data-testid="button-search-location"
                          onClick={handleGeocode}
                          disabled={!locationQuery.trim() || isGeocoding}
                          className="bg-primary text-white shrink-0"
                        >
                          {isGeocoding
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Search className="w-4 h-4" />}
                        </Button>
                      </div>

                      {geocodeError && (
                        <p className="text-xs text-destructive">{geocodeError}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {["New York, NY", "London, UK", "Tokyo, Japan", "Paris, France"].map(suggestion => (
                          <button
                            key={suggestion}
                            onClick={() => { setLocationQuery(suggestion); setGeocodeError(null); }}
                            className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No location at all — required notice */}
                  {!location && !showLocationInput && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-300">Location is required to place your photo on the map.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Collections */}
              {hasFile && location && !showLocationInput && (
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
                        className="bg-primary text-white"
                      >
                        {createCollection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" onClick={() => setIsCreatingCollection(false)} className="text-muted-foreground hover:text-white">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {collectionsQuery.data?.map(col => (
                        <button
                          key={col.id}
                          data-testid={`button-collection-${col.id}`}
                          onClick={() => setCollectionId(collectionId === col.id ? null : col.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            collectionId === col.id
                              ? "bg-primary/20 border-primary text-white"
                              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          <div className="font-medium text-sm truncate">{col.name}</div>
                        </button>
                      ))}
                      <button
                        data-testid="button-new-collection"
                        onClick={() => setIsCreatingCollection(true)}
                        className="p-3 rounded-xl border border-dashed border-white/20 text-white/70 hover:bg-white/5 hover:text-white transition-all flex flex-col items-center justify-center gap-1"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-xs font-medium">New Trip</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload button */}
              {hasFile && (
                <Button
                  data-testid="button-pin-to-map"
                  className="w-full py-6 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg transition-all"
                  onClick={handleUpload}
                  disabled={!canUpload || createPhoto.isPending}
                >
                  {createPhoto.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Pinning to Map...</>
                  ) : (
                    <><MapPin className="w-5 h-5 mr-2" /> Pin to Map</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </DrawerContent>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        className="hidden"
        data-testid="input-file-upload"
      />
    </Drawer>
  );
}
