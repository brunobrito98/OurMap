import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import EventDetails from "@/pages/EventDetails";
import CreateEvent from "@/pages/CreateEvent";
import Profile from "@/pages/Profile";
import MyEvents from "@/pages/MyEvents";
import Friends from "@/pages/Friends";
import Search from "@/pages/Search";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Rota principal - página inicial sem exigir login */}
      <Route path="/" component={Home} />
      
      {/* Rota para login/cadastro */}
      <Route path="/login" component={Landing} />
      
      {/* Rotas públicas - visualização permitida sem login */}
      <Route path="/home" component={Home} />
      <Route path="/event/:id" component={EventDetails} />
      <Route path="/search" component={Search} />
      
      {/* Rotas protegidas - exigem login para acesso */}
      <Route path="/create">
        <ProtectedRoute>
          <CreateEvent />
        </ProtectedRoute>
      </Route>
      
      <Route path="/edit/:id">
        <ProtectedRoute>
          <CreateEvent />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/my-events">
        <ProtectedRoute>
          <MyEvents />
        </ProtectedRoute>
      </Route>
      
      <Route path="/friends">
        <ProtectedRoute>
          <Friends />
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="app-container bg-background text-foreground">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
