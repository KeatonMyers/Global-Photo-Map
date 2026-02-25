import { useState, useEffect, useRef } from "react";
import { PhotoMap } from "@/components/photo-map";
import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/hooks/use-auth";
import WelcomePage from "./welcome";
import { Loader2 } from "lucide-react";

interface DartState {
  imageUrl: string;
  lat: number;
  lng: number;
}

function PhotoDartAnimation({ dart, onDone }: { dart: DartState; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add("dart-active");
      });
    });

    const timer = setTimeout(onDone, 850);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <div
        ref={ref}
        className="dart-photo"
        style={{ backgroundImage: `url(${dart.imageUrl})` }}
      />
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [dart, setDart] = useState<DartState | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <WelcomePage />;
  }

  const handlePhotoUploaded = (lat: number, lng: number, imageUrl: string) => {
    setDart({ imageUrl, lat, lng });
  };

  const handleDartDone = () => {
    setDart(prev => {
      if (prev) setFlyToCoords([prev.lat, prev.lng]);
      return null;
    });
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      <PhotoMap flyToCoords={flyToCoords} />
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <BottomNav onPhotoUploaded={handlePhotoUploaded} />
      {dart && <PhotoDartAnimation dart={dart} onDone={handleDartDone} />}
    </div>
  );
}
