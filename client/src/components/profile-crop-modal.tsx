import { useState, useRef, useCallback, useEffect } from "react";
import { X, Check, Loader2 } from "lucide-react";

interface ProfileCropModalProps {
  imageUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function ProfileCropModal({ imageUrl, onConfirm, onCancel, isSaving }: ProfileCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Crop square position & size (in image-display coordinates)
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 0 });
  const dragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startCrop: typeof crop } | null>(null);

  // Initialize crop square centered on the image
  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    setImgSize({ w, h });
    const size = Math.min(w, h) * 0.75;
    setCrop({
      x: (w - size) / 2,
      y: (h - size) / 2,
      size,
    });
  }, [imgLoaded]);

  const clampCrop = useCallback((c: typeof crop) => {
    const s = Math.max(40, Math.min(c.size, imgSize.w, imgSize.h));
    const x = Math.max(0, Math.min(c.x, imgSize.w - s));
    const y = Math.max(0, Math.min(c.y, imgSize.h - s));
    return { x, y, size: s };
  }, [imgSize]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    if ("touches" in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleStart = (mode: "move" | "resize") => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPos(e);
    dragRef.current = { mode, startX: pos.x, startY: pos.y, startCrop: { ...crop } };
  };

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!dragRef.current) return;
    const pos = getPos(e);
    const dx = pos.x - dragRef.current.startX;
    const dy = pos.y - dragRef.current.startY;
    const sc = dragRef.current.startCrop;

    if (dragRef.current.mode === "move") {
      setCrop(clampCrop({ x: sc.x + dx, y: sc.y + dy, size: sc.size }));
    } else {
      // Resize from corner — use the larger of dx/dy as the delta
      const delta = Math.max(dx, dy);
      setCrop(clampCrop({ x: sc.x, y: sc.y, size: sc.size + delta }));
    }
  }, [clampCrop]);

  const handleEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleConfirm = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();

    // Convert display coords to natural image coords
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sSize = crop.size * Math.min(scaleX, scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 400, 400);
    onConfirm(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
        <button
          onClick={onCancel}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/80"
          disabled={isSaving}
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-white text-sm font-normal">Crop Photo</span>
        <button
          onClick={handleConfirm}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-white"
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        </button>
      </div>

      {/* Image + crop overlay */}
      <div
        ref={containerRef}
        className="relative touch-none select-none"
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Crop preview"
          className="max-w-[90vw] max-h-[70vh] object-contain"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />

        {imgLoaded && crop.size > 0 && (
          <>
            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(to right,
                rgba(0,0,0,0.6) ${(crop.x / imgSize.w) * 100}%,
                transparent ${(crop.x / imgSize.w) * 100}%,
                transparent ${((crop.x + crop.size) / imgSize.w) * 100}%,
                rgba(0,0,0,0.6) ${((crop.x + crop.size) / imgSize.w) * 100}%)`,
            }} />
            {/* Top dark strip */}
            <div className="absolute pointer-events-none" style={{
              left: `${crop.x}px`,
              top: 0,
              width: `${crop.size}px`,
              height: `${crop.y}px`,
              background: "rgba(0,0,0,0.6)",
            }} />
            {/* Bottom dark strip */}
            <div className="absolute pointer-events-none" style={{
              left: `${crop.x}px`,
              top: `${crop.y + crop.size}px`,
              width: `${crop.size}px`,
              height: `${imgSize.h - crop.y - crop.size}px`,
              background: "rgba(0,0,0,0.6)",
            }} />

            {/* Crop border */}
            <div
              className="absolute border-2 border-white/80 cursor-move"
              style={{
                left: `${crop.x}px`,
                top: `${crop.y}px`,
                width: `${crop.size}px`,
                height: `${crop.size}px`,
              }}
              onMouseDown={handleStart("move")}
              onTouchStart={handleStart("move")}
            >
              {/* Corner grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>

              {/* Resize handle — bottom-right corner */}
              <div
                className="absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize"
                onMouseDown={handleStart("resize")}
                onTouchStart={handleStart("resize")}
              >
                <div className="absolute bottom-0 right-0 w-4 h-0.5 bg-white rounded-full" />
                <div className="absolute bottom-0 right-0 w-0.5 h-4 bg-white rounded-full" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
