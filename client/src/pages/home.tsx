import { PhotoMap } from "@/components/photo-map";
import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/hooks/use-auth";
import WelcomePage from "./welcome";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

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

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black">
      <PhotoMap />
      
      {/* Top safe area gradient for visibility of status bar */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      
      <BottomNav />
    </div>
  );
}
