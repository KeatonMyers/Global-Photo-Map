import { useState, useRef, useCallback, useEffect } from "react";
import { X, MapPin } from "lucide-react";
import type { Photo } from "@shared/schema";
import { PinchZoomImage } from "./pinch-zoom-image";
import { DateStamp } from "./date-stamp";

type PhotoItem = Photo & { user?: any; collection?: any };

const DISMISS_THRESHOLD = 80;

interface ProfilePhotoViewerProps {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
}

export function ProfilePhotoViewer({ photos, initialIndex, onClose }: ProfilePhotoViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [exiting, setExiting] = useState(false);
  const [exitOffset, setExitOffset] = useState(0);
  const [isDraggingX, setIsDraggingX] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const hasScrolledToInitial = useRef(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    mountedRef.current = true;
    return () => {
      document.body.style.overflow = "";
      mountedRef.current = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // Scroll to initial photo on mount
  useEffect(() => {
    if (hasScrolledToInitial.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const children = el.querySelectorAll("[data-photo-index]");
    const target = children[initialIndex] as HTMLElement | undefined;
    if (target) {
      el.scrollTo({ top: target.offsetTop, behavior: "instant" as ScrollBehavior });
      hasScrolledToInitial.current = true;
    }
  }, [initialIndex]);

  const dismiss = useCallback(() => {
    setExiting(true);
    setExitOffset(window.innerWidth);
    dismissTimer.current = setTimeout(() => {
      if (mountedRef.current) onClose();
    }, 280);
  }, [onClose]);

  // Use native touch events on the scroll container so we can selectively
  // preventDefault for horizontal swipes while letting vertical scroll through
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let locked: "horizontal" | "vertical" | null = null;
    let dragging = false;
    let latestDx = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      locked = null;
      dragging = false;
      latestDx = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          locked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
          directionLocked.current = locked;
        } else {
          return;
        }
      }

      if (locked === "horizontal" && dx > 0) {
        // Horizontal right swipe — prevent scroll and track offset
        e.preventDefault();
        dragging = true;
        latestDx = dx;
        setIsDraggingX(true);
        setExitOffset(dx);
      }
      // Vertical: do nothing, let native scroll handle it
    };

    const onTouchEnd = () => {
      if (dragging) {
        if (latestDx > DISMISS_THRESHOLD) {
          // Dismiss
          setExiting(true);
          setExitOffset(window.innerWidth);
          dismissTimer.current = setTimeout(() => {
            if (mountedRef.current) onClose();
          }, 280);
        } else {
          setExitOffset(0);
        }
        setIsDraggingX(false);
      }
      locked = null;
      directionLocked.current = null;
      dragging = false;
      latestDx = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose, dismiss]);

  const drag = Math.abs(exitOffset);
  const progress = Math.min(1, drag / 300);
  const viewOpacity = exiting ? 0 : 1 - progress * 0.4;
  const viewScale = 1 - progress * 0.05;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{
        transform: `translateX(${exitOffset}px) scale(${isDraggingX || exiting ? viewScale : 1})`,
        opacity: viewOpacity,
        transition: isDraggingX
          ? "none"
          : exiting
            ? "transform 0.28s ease-out, opacity 0.28s ease-out"
            : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
        borderRadius: progress > 0.05 ? `${progress * 24}px` : "0px",
        willChange: "transform, opacity",
      }}
      data-testid="profile-photo-viewer"
    >
      {/* X close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white/80 active:bg-black/70 transition-colors"
        data-testid="button-close-viewer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Scrollable snap container */}
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory"
        style={{ scrollBehavior: "smooth" }}
      >
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            data-photo-index={index}
            className="snap-center w-full h-[100dvh] relative flex items-center justify-center"
          >
            <PinchZoomImage
              src={photo.imageUrl}
              alt={photo.locationName || "Photo"}
              className="w-full h-full flex items-center justify-center"
              imgClassName="w-full h-full object-contain"
              data-testid={`viewer-photo-${photo.id}`}
            />

            {/* Location overlay at top */}
            {photo.locationName && (
              <div className="absolute top-0 left-0 right-12 bg-gradient-to-b from-black/60 via-black/30 to-transparent px-4 pt-4 pb-10 pointer-events-none">
                <div className="flex items-center gap-1.5 text-white text-sm font-semibold drop-shadow-sm">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{photo.locationName}</span>
                </div>
              </div>
            )}

            {/* Retro camera date stamp */}
            <div className="absolute bottom-3 right-4 pointer-events-none">
              <DateStamp date={photo.takenAt || photo.createdAt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
