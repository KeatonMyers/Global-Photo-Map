import { useRef, useState, useCallback } from "react";

interface PinchZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  onGestureStateChange?: (isZoomed: boolean) => void;
  "data-testid"?: string;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

function getDistance(t1: React.Touch, t2: React.Touch) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(t1: React.Touch, t2: React.Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export function PinchZoomImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  onGestureStateChange,
  "data-testid": testId,
}: PinchZoomImageProps) {
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{
    initialDistance: number;
    initialScale: number;
    initialX: number;
    initialY: number;
    midX: number;
    midY: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const isZoomedRef = useRef(false);

  const resetTransform = useCallback(() => {
    setIsAnimating(true);
    setTransform({ scale: 1, x: 0, y: 0 });
    if (isZoomedRef.current) {
      isZoomedRef.current = false;
      onGestureStateChange?.(false);
    }
    setTimeout(() => setIsAnimating(false), 300);
  }, [onGestureStateChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      setIsAnimating(false);
      const dist = getDistance(e.touches[0], e.touches[1]);
      const mid = getMidpoint(e.touches[0], e.touches[1]);
      pinchRef.current = {
        initialDistance: dist,
        initialScale: transform.scale,
        initialX: transform.x,
        initialY: transform.y,
        midX: mid.x,
        midY: mid.y,
      };
      panRef.current = null;
    } else if (e.touches.length === 1 && transform.scale > 1) {
      e.stopPropagation();
      setIsAnimating(false);
      panRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        initialX: transform.x,
        initialY: transform.y,
      };
    }
  }, [transform]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.stopPropagation();
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const mid = getMidpoint(e.touches[0], e.touches[1]);
      const scaleRatio = dist / pinchRef.current.initialDistance;
      const newScale = Math.min(5, Math.max(1, pinchRef.current.initialScale * scaleRatio));

      const dx = mid.x - pinchRef.current.midX;
      const dy = mid.y - pinchRef.current.midY;

      setTransform({
        scale: newScale,
        x: pinchRef.current.initialX + dx,
        y: pinchRef.current.initialY + dy,
      });

      if (!isZoomedRef.current && newScale > 1.05) {
        isZoomedRef.current = true;
        onGestureStateChange?.(true);
      }
    } else if (e.touches.length === 1 && panRef.current && transform.scale > 1) {
      e.stopPropagation();
      e.preventDefault();
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      setTransform((prev) => ({
        ...prev,
        x: panRef.current!.initialX + dx,
        y: panRef.current!.initialY + dy,
      }));
    }
  }, [transform.scale, onGestureStateChange]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      pinchRef.current = null;
      panRef.current = null;
      if (transform.scale <= 1.05) {
        resetTransform();
      }
    } else if (e.touches.length === 1) {
      pinchRef.current = null;
      if (transform.scale > 1) {
        panRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          initialX: transform.x,
          initialY: transform.y,
        };
      }
    }
  }, [transform, resetTransform]);

  const handleDoubleTap = useCallback(() => {
    if (transform.scale > 1.05) {
      resetTransform();
    } else {
      setIsAnimating(true);
      setTransform({ scale: 2.5, x: 0, y: 0 });
      isZoomedRef.current = true;
      onGestureStateChange?.(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [transform.scale, resetTransform, onGestureStateChange]);

  const lastTapRef = useRef(0);
  const handleTap = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 0) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      handleDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [handleDoubleTap]);

  const combinedTouchEnd = useCallback((e: React.TouchEvent) => {
    handleTouchEnd(e);
    handleTap(e);
  }, [handleTouchEnd, handleTap]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={combinedTouchEnd}
      data-testid={testId}
    >
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        draggable={false}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "center center",
          transition: isAnimating ? "transform 0.3s ease-out" : "none",
          willChange: "transform",
        }}
      />
    </div>
  );
}
