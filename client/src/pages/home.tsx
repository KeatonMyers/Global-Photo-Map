import { useState } from "react";
import { PhotoMap } from "@/components/photo-map";
import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/hooks/use-auth";
import WelcomePage from "./welcome";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);

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

  const handlePhotoUploaded = (lat: number, lng: number) => {
    setFlyToCoords([lat, lng]);
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      <PhotoMap flyToCoords={flyToCoords} />
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <BottomNav onPhotoUploaded={handlePhotoUploaded} />
    </div>
  );
}
