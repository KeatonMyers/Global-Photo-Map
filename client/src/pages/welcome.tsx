import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

export default function WelcomePage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin
        ? { email, password }
        : { email, password, firstName, lastName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-end bg-black text-white relative overflow-hidden">
      {/* Full-screen background image */}
      <img
        src="/atlas-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/90" />

      <div className="z-10 w-full max-w-md flex flex-col items-center text-center px-6 pb-10">
        {/* Title area — pushed toward upper-middle via spacer */}
        <div className="mb-auto" />

        <h1 className="text-5xl font-bold tracking-tight mb-1" style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}>
          AtlasDuo
        </h1>
        <p className="text-white/60 text-sm mb-8 tracking-wide">
          Your World, Mapped.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          {!isLogin && (
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-black/40 backdrop-blur-md border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-black/40 backdrop-blur-md border-white/20 text-white placeholder:text-white/40"
              />
            </div>
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-black/40 backdrop-blur-md border-white/20 text-white placeholder:text-white/40"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-black/40 backdrop-blur-md border-white/20 text-white placeholder:text-white/40"
          />

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full py-6 text-lg rounded-2xl bg-white text-black hover:bg-gray-100 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? "Please wait..." : isLogin ? "Log In" : "Create Account"}
          </Button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(""); }}
          className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
