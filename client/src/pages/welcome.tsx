import { Globe2, MapPin, Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-black text-white relative overflow-hidden px-6">
      {/* Background aesthetic blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/30 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-600/20 rounded-full blur-[100px]" />
      
      <div className="z-10 w-full max-w-md flex flex-col items-center text-center">
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full group-hover:bg-primary/60 transition-colors duration-500" />
          <div className="w-24 h-24 bg-gradient-to-tr from-primary to-blue-400 rounded-3xl shadow-2xl flex items-center justify-center relative z-10 border border-white/20">
            <Globe2 className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
          Your World,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-primary">
            Mapped.
          </span>
        </h1>
        
        <p className="text-lg text-muted-foreground mb-12 max-w-sm leading-relaxed">
          Upload your photos and watch them populate on a beautiful, interactive global map. Share your journey and discover places through the lenses of others.
        </p>

        <div className="space-y-6 w-full mb-12 text-left">
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 glass-panel">
            <div className="bg-primary/20 p-3 rounded-xl">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Automatic Placement</h3>
              <p className="text-sm text-white/60">GPS data pins photos instantly</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 glass-panel">
            <div className="bg-blue-500/20 p-3 rounded-xl">
              <Camera className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Trips & Collections</h3>
              <p className="text-sm text-white/60">Group your memories naturally</p>
            </div>
          </div>
        </div>

        <Button 
          size="lg" 
          onClick={handleLogin}
          className="w-full py-7 text-lg rounded-2xl bg-white text-black hover:bg-gray-100 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] active:scale-95"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Continue with Replit
        </Button>
        <p className="mt-4 text-xs text-white/40">Secure, fast login via Replit Auth</p>
      </div>
    </div>
  );
}
