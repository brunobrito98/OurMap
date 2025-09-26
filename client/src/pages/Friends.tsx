import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Friendship } from "@shared/schema";
import { ArrowLeft, UserPlus, Users, Eye, Check, X, Search, Clock, MessageCircle } from "lucide-react";

export default function Friends() {
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  // Fetch friends
  const { data: friends = [], isLoading: friendsLoading } = useQuery<User[]>({
    queryKey: ['/api/friends'],
    enabled: !!authUser,
  });

  // Fetch pending friend requests
  const { data: pendingRequests = [], isLoading: requestsLoading } = useQuery<(Friendship & { requester: User })[]>({
    queryKey: ['/api/friend-requests'],
    enabled: !!authUser,
  });

  // Accept/reject friend request mutation
  const respondToRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      return await apiRequest(`/api/friend-requests/${requestId}`, 'PUT', { status });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === 'accepted' ? "Solicitação aceita!" : "Solicitação recusada",
        description: variables.status === 'accepted' 
          ? "Agora vocês são amigos!" 
          : "A solicitação foi removida.",
      });
      // Invalidate both friends and requests queries
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível processar a solicitação.",
        variant: "destructive",
      });
    },
  });

  const handleAcceptRequest = (requestId: string) => {
    respondToRequestMutation.mutate({ requestId, status: 'accepted' });
  };

  const handleRejectRequest = (requestId: string) => {
    respondToRequestMutation.mutate({ requestId, status: 'declined' });
  };

  if (friendsLoading || requestsLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="animate-pulse">
          <div className="h-16 bg-muted"></div>
          <div className="p-4 space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </div>
        <BottomNavigation activeTab="friends" />
      </div>
    );
  }

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
          <h2 className="font-semibold text-foreground flex-1">Amigos</h2>
          <Button
            onClick={() => navigate("/search")}
            variant="ghost"
            size="sm"
            data-testid="button-search-friends"
          >
            <UserPlus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Meus Amigos ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              Pedidos Pendentes ({pendingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-4">
            {friends.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <Users className="w-16 h-16" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum amigo ainda
                </h3>
                <p className="text-muted-foreground mb-4">
                  Use a busca para encontrar e adicionar amigos!
                </p>
                <Button 
                  onClick={() => navigate("/search")}
                  data-testid="button-find-friends"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Buscar Amigos
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-white rounded-lg border border-border p-4 shadow-sm"
                    data-testid={`friend-card-${friend.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={friend.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {friend.firstName?.[0]}{friend.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground" data-testid={`friend-name-${friend.id}`}>
                          {friend.firstName} {friend.lastName}
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid={`friend-username-${friend.id}`}>
                          @{friend.username}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/chat?start=${friend.id}`);
                          }}
                          data-testid={`button-message-${friend.id}`}
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Mensagem
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${friend.username}`);
                          }}
                          data-testid={`button-view-profile-${friend.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Perfil
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <Clock className="w-16 h-16" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhuma solicitação pendente
                </h3>
                <p className="text-muted-foreground">
                  Quando alguém enviar uma solicitação de amizade, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-lg border border-border p-4 shadow-sm"
                    data-testid={`request-card-${request.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={request.requester.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {request.requester.firstName?.[0]}{request.requester.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground" data-testid={`requester-name-${request.id}`}>
                          {request.requester.firstName} {request.requester.lastName}
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid={`requester-username-${request.id}`}>
                          @{request.requester.username}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado {request.createdAt ? new Date(request.createdAt).toLocaleDateString('pt-BR') : ''}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={respondToRequestMutation.isPending}
                          size="sm"
                          data-testid={`button-accept-${request.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Aceitar
                        </Button>
                        <Button
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={respondToRequestMutation.isPending}
                          variant="outline"
                          size="sm"
                          data-testid={`button-reject-${request.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Recusar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation activeTab="friends" />
    </div>
  );
}