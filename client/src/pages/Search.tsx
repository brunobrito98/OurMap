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
import { ArrowLeft, Search as SearchIcon, Calendar, Users, UserPlus, Eye, Crown, Check, Filter } from "lucide-react";

export default function Search() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "users">("events");
  const [userCity, setUserCity] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<number | undefined>(undefined);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get user's current city
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          // Reverse geocode to get city name
          fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(location),
          })
            .then(res => res.json())
            .then(data => {
              if (data.city) {
                setUserCity(data.city);
              }
            })
            .catch(console.error);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Set empty string so the query is not blocked
          setUserCity('');
        }
      );
    }
  }, []);

  // Search users
  const { data: userResults = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/search/users', debouncedQuery],
    enabled: debouncedQuery.length >= 2 && activeTab === "users",
  });

  // Search ended events (main functionality) - always used for events tab
  const { data: endedEventResults = [], isLoading: endedEventsLoading } = useQuery<EventWithDetails[]>({
    queryKey: ['/api/search/ended-events', userCity ?? '', periodFilter ?? '', debouncedQuery || ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userCity) params.append('cityName', userCity);
      if (periodFilter) params.append('daysBack', periodFilter.toString());
      if (debouncedQuery && debouncedQuery.trim().length >= 2) params.append('searchQuery', debouncedQuery);
      
      const url = `/api/search/ended-events?${params.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch ended events');
      return response.json();
    },
    enabled: activeTab === "events",
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (addresseeId: string) => {
      return await apiRequest('/api/friend-requests', 'POST', { addresseeId });
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
    return authUser && typeof authUser === 'object' && 'id' in authUser && authUser.id === userId;
  };

  // Always use ended events for the events tab
  const displayEvents = endedEventResults;
  const isLoadingEvents = endedEventsLoading;

  // Handle period filter change
  const handlePeriodFilterChange = (days: number | undefined) => {
    setPeriodFilter(days);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground">Buscar</h2>
        </div>
      </div>

      <div className="p-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
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
              <Calendar className="w-4 h-4 mr-2" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-4">
            {/* Period filters - only show when no search query */}
            {debouncedQuery.length < 2 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Filtrar por período:</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={periodFilter === undefined ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodFilterChange(undefined)}
                    data-testid="filter-all"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={periodFilter === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodFilterChange(2)}
                    data-testid="filter-2-days"
                  >
                    Últimos 2 dias
                  </Button>
                  <Button
                    variant={periodFilter === 7 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodFilterChange(7)}
                    data-testid="filter-7-days"
                  >
                    Últimos 7 dias
                  </Button>
                </div>
              </div>
            )}

            {debouncedQuery.length < 2 ? (
              // Show ended events by default
              userCity === null ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    <i className="fas fa-map-marker-alt text-4xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Obtendo sua localização...
                  </h3>
                  <p className="text-muted-foreground">
                    Aguarde enquanto identificamos sua cidade para mostrar eventos da sua região.
                  </p>
                </div>
              ) : isLoadingEvents ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-muted rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : displayEvents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    <i className="fas fa-calendar-times text-4xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Nenhum evento encerrado encontrado
                  </h3>
                  <p className="text-muted-foreground">
                    Não há eventos encerrados recentemente em {userCity}.
                    {periodFilter && ` Tente expandir o período ou remover o filtro.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-3">
                    Mostrando eventos encerrados em {userCity}
                    {periodFilter && ` (últimos ${periodFilter} dias)`}
                  </div>
                  {displayEvents.map((event) => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onClick={() => navigate(`/event/${event.id}`)}
                    />
                  ))}
                </div>
              )
            ) : isLoadingEvents ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : displayEvents.length === 0 ? (
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
                <div className="text-sm text-muted-foreground mb-3">
                  Resultados da busca: "{debouncedQuery}"
                </div>
                {displayEvents.map((event) => (
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
                            <Crown className="w-3 h-3 mr-1" />
                            Administrador
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {isCurrentUser(user.id) ? (
                          <Badge variant="outline">Você</Badge>
                        ) : isAlreadyFriend(user.id) ? (
                          <Badge variant="default">
                            <Check className="w-3 h-3 mr-1" />
                            Amigo
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => handleSendFriendRequest(user.id)}
                            disabled={sendFriendRequestMutation.isPending}
                            size="sm"
                            data-testid={`button-add-friend-${user.id}`}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
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