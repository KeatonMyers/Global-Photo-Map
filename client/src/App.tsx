import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Feed from "@/pages/feed";
import Profile from "@/pages/profile";
import SearchPage from "@/pages/search";
import UserProfilePage from "@/pages/user-profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/feed" component={Feed} />
      <Route path="/profile" component={Profile} />
      <Route path="/search" component={SearchPage} />
      <Route path="/user/:id" component={UserProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
