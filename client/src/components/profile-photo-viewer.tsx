import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Photo } from "@shared/schema";

type PhotoItem = Photo & { user?: any; collection?: any };

const DISMISS_THRESHOLD = 80;
const SWIPE_NAV_THRESHOLD = 60;

interface ProfilePhotoViewerProps {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
}

export function ProfilePhotoViewer({ photos, initialIndex, onClose }: ProfilePhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const latestDx = useRef(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const photo = photos[currentIndex];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    mountedRef.current = true;
    return () => {
      document.body.style.overflow = "";
      mountedRef.current = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (slideTimer.current) clearTimeout(slideTimer.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setOffset({ x: window.innerWidth, y: 0 });
    dismissTimer.current = setTimeout(() => {
      if (mountedRef.current) onClose();
    }, 280);
  }, [onClose]);

  const goToPhoto = useCallback((direction: "left" | "right") => {
    const nextIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    setSlideDirection(direction);
    slideTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setCurrentIndex(nextIndex);
      setSlideDirection(null);
    }, 200);
  }, [currentIndex, photos.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    directionLocked.current = null;
    latestDx.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (!directionLocked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      } else {
        return;
      }
    }

    if (directionLocked.current === "horizontal") {
      latestDx.current = dx;
      setOffset({ x: dx, y: 0 });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (!touchStartRef.current) return;

    const dx = latestDx.current;

    if (directionLocked.current === "horizontal") {
      if (dx > DISMISS_THRESHOLD && currentIndex === 0) {
        dismiss();
      } else if (dx > SWIPE_NAV_THRESHOLD && currentIndex > 0) {
        goToPhoto("right");
      } else if (dx < -SWIPE_NAV_THRESHOLD && currentIndex < photos.length - 1) {
        goToPhoto("left");
      }
    }

    setOffset({ x: 0, y: 0 });
    latestDx.current = 0;
    touchStartRef.current = null;
    directionLocked.current = null;
  };

  const progress = Math.min(1, Math.abs(offset.x) / 200);
  const viewOpacity = exiting ? 0 : 1 - progress * 0.3;
  const viewScale = 1 - progress * 0.03;

  let slideTransform = "";
  if (slideDirection === "left") slideTransform = "translateX(-100%)";
  else if (slideDirection === "right") slideTransform = "translateX(100%)";

  return (
    <div
      className="fixed inset-0 z-50 bg-black touch-none"
      style={{
        transform: `translateX(${isDragging ? offset.x : 0}px) scale(${isDragging ? viewScale : exiting ? 0.95 : 1})`,
        opacity: viewOpacity,
        transition: isDragging
          ? "none"
          : exiting
            ? "transform 0.28s ease-out, opacity 0.28s ease-out"
            : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
        borderRadius: progress > 0.05 ? `${progress * 24}px` : "0px",
        willChange: "transform, opacity",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="profile-photo-viewer"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: slideTransform,
          transition: slideDirection ? "transform 0.2s ease-out" : "none",
        }}
      >
        <img
          src={photo.imageUrl}
          alt="Photo"
          className="max-w-full max-h-full object-contain"
          draggable={false}
          data-testid="profile-photo-fullscreen"
        />
      </div>

      <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
        <div className="w-10 h-1 rounded-full bg-white/40" />
      </div>

      {photos.length > 1 && (
        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/50 text-xs font-medium text-white/70" data-testid="text-photo-counter">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5" style={{ paddingBottom: "max(32px, calc(env(safe-area-inset-bottom) + 12px))", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
        <div className="min-w-0 mb-1">
          <div className="font-bold text-white text-lg leading-tight truncate">
            {photo.locationName || `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`}
          </div>
          {photo.takenAt && (
            <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{format(new Date(photo.takenAt), "MMMM d, yyyy")}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-white/50 text-xs mt-1">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}
