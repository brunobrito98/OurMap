import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { WebSocketProvider } from "@/hooks/useGlobalWebSocket";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import EventDetails from "@/pages/EventDetails";
import CreateEvent from "@/pages/CreateEvent";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";
import MyEvents from "@/pages/MyEvents";
import EventInvites from "@/pages/EventInvites";
import Friends from "@/pages/Friends";
import Search from "@/pages/Search";
import Chat from "@/pages/Chat";
import ChatConversation from "@/pages/ChatConversation";

import EditProfile from "@/pages/EditProfile";
import ChangePassword from "@/pages/ChangePassword";
import ChangePhone from "@/pages/ChangePhone";
import { Notifications } from "@/pages/Notifications";
import { NotificationSettings } from "@/pages/NotificationSettings";
import MyRatings from "@/pages/MyRatings";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

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
      <Route path="/profile/:username" component={UserProfile} />
      
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
      
      <Route path="/invites">
        <ProtectedRoute>
          <EventInvites />
        </ProtectedRoute>
      </Route>
      
      <Route path="/friends">
        <ProtectedRoute>
          <Friends />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat">
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat/:id">
        <ProtectedRoute>
          <ChatConversation />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings/profile">
        <ProtectedRoute>
          <EditProfile />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings/change-password">
        <ProtectedRoute>
          <ChangePassword />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings/change-phone">
        <ProtectedRoute>
          <ChangePhone />
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      </Route>

      <Route path="/notifications/settings">
        <ProtectedRoute>
          <NotificationSettings />
        </ProtectedRoute>
      </Route>

      <Route path="/profile/my-ratings">
        <ProtectedRoute>
          <MyRatings />
        </ProtectedRoute>
      </Route>

      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WebSocketProvider>
          <div className="app-container bg-background text-foreground">
            <Toaster />
            <Router />
          </div>
        </WebSocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
