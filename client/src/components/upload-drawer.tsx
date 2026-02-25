import { useState, useRef } from "react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerHeader, DrawerDescription } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { useCreatePhoto } from "@/hooks/use-photos";
import { ImagePlus, MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";
import exifr from "exifr";

interface UploadDrawerProps {
  children: React.ReactNode;
  onUploaded?: (lat: number, lng: number, imageUrl: string) => void;
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

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`,
      { headers: { "User-Agent": "PhotoMapApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.hamlet || a.county || "";
    const state = a.state || a.region || "";
    const country = a.country || "";
    const parts = [city, state, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

interface BatchProgress {
  total: number;
  done: number;
  pinned: number;
  skipped: number;
  lastPinned: { lat: number; lng: number; imageUrl: string } | null;
}

export function UploadDrawer({ children, onUploaded }: UploadDrawerProps) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const createPhoto = useCreatePhoto();

  const isDone = progress !== null && progress.done === progress.total;

  const resetState = () => {
    setProgress(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) setTimeout(resetState, 300);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Reset file input so same files can be re-selected later
    e.target.value = "";

    const initial: BatchProgress = { total: files.length, done: 0, pinned: 0, skipped: 0, lastPinned: null };
    setProgress(initial);

    let pinned = 0;
    let skipped = 0;
    let lastPinned: BatchProgress["lastPinned"] = null;

    for (const file of files) {
      try {
        const exifData = await exifr.parse(file, { gps: true, tiff: true });

        const lat = exifData?.latitude ?? null;
        const lng = exifData?.longitude ?? null;

        if (!lat || !lng) {
          // No GPS — skip silently
          skipped++;
          setProgress(prev => prev ? { ...prev, done: prev.done + 1, skipped } : null);
          continue;
        }

        const takenAt = exifData?.DateTimeOriginal
          ? new Date(exifData.DateTimeOriginal)
          : new Date(file.lastModified);

        const [imageUrl, locationName] = await Promise.all([
          resizeImage(file, 1200, 0.82),
          reverseGeocode(lat, lng),
        ]);

        await createPhoto.mutateAsync({
          imageUrl,
          latitude: lat,
          longitude: lng,
          locationName: locationName ?? undefined,
          takenAt,
          collectionId: null,
        });

        pinned++;
        lastPinned = { lat, lng, imageUrl };
        setProgress(prev => prev ? { ...prev, done: prev.done + 1, pinned, lastPinned } : null);
      } catch (err) {
        console.error("Failed to process photo:", err);
        skipped++;
        setProgress(prev => prev ? { ...prev, done: prev.done + 1, skipped } : null);
      }
    }

    // Summary toast
    if (pinned > 0) {
      toast({
        title: pinned === 1 ? "1 photo pinned!" : `${pinned} photos pinned!`,
        description: skipped > 0
          ? `${skipped} photo${skipped > 1 ? "s" : ""} skipped (no GPS data).`
          : "All photos have been placed on the map.",
      });
      if (lastPinned) {
        onUploaded?.(lastPinned.lat, lastPinned.lng, lastPinned.imageUrl);
      }
    } else {
      toast({
        title: "No photos pinned",
        description: "None of the selected photos had GPS location data.",
        variant: "destructive",
      });
    }

    // Close after a brief moment so user can see the completion state
    setTimeout(() => setOpen(false), 600);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>

      <DrawerContent className="bg-zinc-700 backdrop-blur-2xl border-zinc-600 text-white max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-display text-white">Add to Map</DrawerTitle>
          <DrawerDescription className="text-zinc-300">
            Select one or more photos. GPS-tagged photos are pinned automatically.
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-6 pb-safe">
          {!progress ? (
            /* Select zone */
            <div
              data-testid="upload-drop-zone"
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-500 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 hover:border-primary/70 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ImagePlus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Select Photos</h3>
              <p className="text-sm text-zinc-300 text-center">
                Tap to choose one or more photos.<br />
                GPS metadata is read automatically.
              </p>
            </div>
          ) : (
            /* Progress / done state */
            <div className="flex flex-col items-center gap-5 py-4">
              {!isDone ? (
                <>
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">
                      Pinning photos…
                    </p>
                    <p className="text-sm text-zinc-300 mt-1">
                      {progress.done} of {progress.total} processed
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {progress.pinned > 0
                    ? <CheckCircle className="w-12 h-12 text-green-400" />
                    : <XCircle className="w-12 h-12 text-destructive" />}
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">
                      {progress.pinned > 0
                        ? `${progress.pinned} photo${progress.pinned > 1 ? "s" : ""} pinned!`
                        : "No photos pinned"}
                    </p>
                    {progress.skipped > 0 && (
                      <p className="text-sm text-zinc-300 mt-1 flex items-center justify-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {progress.skipped} skipped — no GPS data
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Progress bar */}
              <div className="w-full bg-zinc-600 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </DrawerContent>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        multiple
        className="hidden"
        data-testid="input-file-upload"
      />
    </Drawer>
  );
}
