import { Link, useLocation } from "wouter";
import { Map, User, PlusCircle } from "lucide-react";
import { UploadDrawer } from "./upload-drawer";

interface BottomNavProps {
  onPhotoUploaded?: (lat: number, lng: number, imageUrl: string) => void;
}

export function BottomNav({ onPhotoUploaded }: BottomNavProps) {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="glass mx-4 mb-4 rounded-3xl p-2 flex items-center justify-around relative">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all duration-300 ${
            location === "/" ? "bg-white/10 text-primary" : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
          data-testid="nav-map"
        >
          <Map className={`w-6 h-6 ${location === "/" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium mt-1">Map</span>
        </Link>

        <div className="relative -top-6">
          <UploadDrawer onUploaded={onPhotoUploaded}>
            <button
              data-testid="button-upload-photo"
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-blue-400 p-1 shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <PlusCircle className="w-8 h-8 fill-white/20" />
            </button>
          </UploadDrawer>
        </div>

        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all duration-300 ${
            location === "/profile" ? "bg-white/10 text-primary" : "text-muted-foreground hover:text-white hover:bg-white/5"
          }`}
          data-testid="nav-profile"
        >
          <User className={`w-6 h-6 ${location === "/profile" ? "fill-primary/20" : ""}`} />
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>
      </div>
    </div>
  );
}
