import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, EventWithDetails } from "@shared/schema";

export default function Search() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "users">("events");

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search users
  const { data: userResults = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/search/users', debouncedQuery],
    enabled: debouncedQuery.length >= 2 && activeTab === "users",
  });

  // Search events
  const { data: eventResults = [], isLoading: eventsLoading } = useQuery<EventWithDetails[]>({
    queryKey: ['/api/search/events', debouncedQuery],
    enabled: debouncedQuery.length >= 2 && activeTab === "events",
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (addresseeId: string) => {
      return await apiRequest('POST', '/api/friend-requests', { addresseeId });
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de amizade foi enviada.",
      });
      // Invalidate search results to update the button states
      queryClient.invalidateQueries({ queryKey: ['/api/search/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
    },
  });

  // Check if users are already friends or have pending requests
  const { data: friends = [] } = useQuery<User[]>({
    queryKey: ['/api/friends'],
    enabled: !!authUser,
  });

  const handleSendFriendRequest = (userId: string) => {
    sendFriendRequestMutation.mutate(userId);
  };

  const isAlreadyFriend = (userId: string) => {
    return friends.some(friend => friend.id === userId);
  };

  const isCurrentUser = (userId: string) => {
    return authUser && authUser.id === userId;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/home")}
            variant="ghost"
            size="sm"
            data-testid="button-back"
          >
            <i className="fas fa-arrow-left text-xl"></i>
          </Button>
          <h2 className="font-semibold text-foreground">Buscar</h2>
        </div>
      </div>

      <div className="p-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
            <Input
              type="text"
              placeholder="Digite para buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "events" | "users")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="events" data-testid="tab-events">
              <i className="fas fa-calendar mr-2"></i>
              Eventos
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <i className="fas fa-users mr-2"></i>
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-4">
            {debouncedQuery.length < 2 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <i className="fas fa-search text-4xl"></i>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Buscar Eventos
                </h3>
                <p className="text-muted-foreground">
                  Digite pelo menos 2 caracteres para encontrar eventos por título, descrição ou localização.
                </p>
              </div>
            ) : eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : eventResults.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <i className="fas fa-calendar-times text-4xl"></i>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum evento encontrado
                </h3>
                <p className="text-muted-foreground">
                  Tente buscar com termos diferentes.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {eventResults.map((event) => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onClick={() => navigate(`/event/${event.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            {debouncedQuery.length < 2 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <i className="fas fa-user-search text-4xl"></i>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Buscar Usuários
                </h3>
                <p className="text-muted-foreground">
                  Digite pelo menos 2 caracteres para encontrar usuários por nome ou username.
                </p>
              </div>
            ) : usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : userResults.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <i className="fas fa-user-slash text-4xl"></i>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum usuário encontrado
                </h3>
                <p className="text-muted-foreground">
                  Tente buscar com termos diferentes.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userResults.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white rounded-lg border border-border p-4 shadow-sm"
                    data-testid={`user-result-${user.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground" data-testid={`user-name-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid={`user-username-${user.id}`}>
                          @{user.username}
                        </p>
                        {user.role === 'admin' && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            <i className="fas fa-crown mr-1"></i>
                            Administrador
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {isCurrentUser(user.id) ? (
                          <Badge variant="outline">Você</Badge>
                        ) : isAlreadyFriend(user.id) ? (
                          <Badge variant="default">
                            <i className="fas fa-check mr-1"></i>
                            Amigo
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => handleSendFriendRequest(user.id)}
                            disabled={sendFriendRequestMutation.isPending}
                            size="sm"
                            data-testid={`button-add-friend-${user.id}`}
                          >
                            <i className="fas fa-user-plus mr-2"></i>
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation activeTab="search" />
    </div>
  );
}