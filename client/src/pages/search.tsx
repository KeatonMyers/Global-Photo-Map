import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/bottom-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X } from "lucide-react";

interface UserResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery<UserResult[]>({
    queryKey: ["/api/users/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length > 0,
  });

  const handleUserClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24">
      <div className="pt-safe px-4 pb-3">
        <div className="relative mt-4 mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full h-11 pl-10 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            data-testid="input-search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {!debouncedQuery && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Search for other users by name
          </div>
        )}

        {isLoading && debouncedQuery && (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {debouncedQuery && !isLoading && results && results.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No users found
          </div>
        )}

        {debouncedQuery && results && results.length > 0 && (
          <div className="space-y-1">
            {results.map((user) => {
              const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
              const initials = (user.firstName?.[0] || "") + (user.lastName?.[0] || "") || "U";
              return (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                  data-testid={`user-result-${user.id}`}
                >
                  <Avatar className="w-12 h-12 border border-white/10">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-white/5 text-white text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-white font-medium text-sm" data-testid={`text-username-${user.id}`}>{name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
