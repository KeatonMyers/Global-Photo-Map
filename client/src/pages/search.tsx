import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, UserPlus, UserCheck } from "lucide-react";

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: friendIds } = useQuery<string[]>({
    queryKey: ["/api/friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    enabled: !!user,
  });

  const addFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add friend");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/map-markers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove friend");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/map-markers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const friendSet = new Set(friendIds || []);

  const handleUserClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const handleToggleFriend = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (friendSet.has(userId)) {
      removeFriendMutation.mutate(userId);
    } else {
      addFriendMutation.mutate(userId);
    }
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
            {results.map((resultUser) => {
              const name = [resultUser.firstName, resultUser.lastName].filter(Boolean).join(" ") || "User";
              const initials = (resultUser.firstName?.[0] || "") + (resultUser.lastName?.[0] || "") || "U";
              const isSelf = user?.id === resultUser.id;
              const isFriend = friendSet.has(resultUser.id);
              return (
                <div
                  key={resultUser.id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                  data-testid={`user-result-${resultUser.id}`}
                >
                  <button
                    onClick={() => handleUserClick(resultUser.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <Avatar className="w-12 h-12 border border-white/10">
                      <AvatarImage src={resultUser.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-white/5 text-white text-sm font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm truncate" data-testid={`text-username-${resultUser.id}`}>{name}</div>
                      {isFriend && <div className="text-primary text-xs">Friend</div>}
                    </div>
                  </button>
                  {!isSelf && user && (
                    <button
                      onClick={(e) => handleToggleFriend(e, resultUser.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isFriend
                          ? "bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400"
                          : "bg-primary/20 text-primary hover:bg-primary/30"
                      }`}
                      data-testid={`button-friend-${resultUser.id}`}
                    >
                      {isFriend ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Added
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Add
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
