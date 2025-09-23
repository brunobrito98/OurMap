import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EventWithDetails } from "@shared/schema";

interface UserProfileResponse {
  name: string;
  username: string;
  profile_picture_url: string | null;
  phone_number?: string | null;
  events?: EventWithDetails[];
}

export default function UserProfile() {
  const { username } = useParams();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract username without @ symbol
  const actualUsername = username?.startsWith('@') ? username.slice(1) : username;

  // Fetch user profile
  const { data: profile, isLoading, error } = useQuery<UserProfileResponse>({
    queryKey: ['/api/users', actualUsername],
    enabled: !!actualUsername,
  });

  // Connection request mutation
  const connectionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/friend-requests', 'POST', { 
        username: actualUsername
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', actualUsername] });
      toast({
        title: "Sucesso",
        description: "Solicitação de conexão enviada!",
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Erro ao enviar solicitação de conexão";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse p-4">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-muted rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-4">
          <Avatar className="w-16 h-16 mx-auto mb-4">
            <AvatarFallback>
              <i className="fas fa-user text-2xl text-muted-foreground"></i>
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Usuário não encontrado
          </h2>
          <p className="text-muted-foreground mb-4">
            Este perfil não existe ou não está disponível.
          </p>
          <Button onClick={() => navigate("/")} data-testid="button-back-home">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // Check if this is a full profile (has phone_number or events)
  const isFullProfile = 'phone_number' in profile || 'events' in profile;
  const canViewFullProfile = isFullProfile;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => window.history.back()}
              variant="ghost"
              size="sm"
              data-testid="button-back"
              title="Voltar"
            >
              <i className="fas fa-arrow-left text-xl"></i>
            </Button>
            <h2 className="font-semibold text-foreground">Perfil</h2>
          </div>
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            data-testid="button-home"
            title="Ir para início"
          >
            <i className="fas fa-home text-xl"></i>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Profile Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Avatar className="w-20 h-20" data-testid="img-profile-picture">
            <AvatarImage src={profile.profile_picture_url || undefined} />
            <AvatarFallback className="text-xl">
              {profile.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-user-name">
              {profile.name}
            </h1>
            <p className="text-muted-foreground" data-testid="text-user-username">
              @{profile.username}
            </p>
          </div>
        </div>

        {/* Connection Status & Actions */}
        {isAuthenticated && profile.username !== (user as any)?.username && (
          <div className="mb-6">
            {!canViewFullProfile ? (
              <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4">
                <div className="text-center">
                  <i className="fas fa-user-friends text-accent text-2xl mb-2"></i>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para ver o perfil completo, adicione {profile.name.split(' ')[0]} às suas conexões
                  </p>
                  <Button
                    onClick={() => connectionMutation.mutate()}
                    disabled={connectionMutation.isPending}
                    className="w-full"
                    data-testid="button-add-user"
                  >
                    {connectionMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus mr-2"></i>
                        Adicionar Usuário
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center justify-center space-x-2">
                  <i className="fas fa-check-circle text-green-600"></i>
                  <p className="text-sm text-green-700 font-medium">
                    Vocês são conexões
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact Information */}
        {canViewFullProfile && profile.phone_number && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <h3 className="font-semibold text-foreground mb-3">Contato</h3>
            <div className="flex items-center space-x-2" data-testid="text-phone-number">
              <i className="fas fa-phone text-muted-foreground"></i>
              <span className="text-foreground">{profile.phone_number}</span>
            </div>
          </div>
        )}

        {/* User's Confirmed Events */}
        {canViewFullProfile && profile.events && profile.events.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-4">
              Eventos Confirmados ({profile.events.length})
            </h3>
            <div className="space-y-4">
              {profile.events.map((event) => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onClick={() => navigate(`/event/${event.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Events Message */}
        {canViewFullProfile && profile.events && profile.events.length === 0 && (
          <div className="text-center py-8">
            <i className="fas fa-calendar text-4xl text-muted-foreground mb-4"></i>
            <p className="text-muted-foreground">
              {profile.name.split(' ')[0]} ainda não confirmou presença em nenhum evento
            </p>
          </div>
        )}
      </div>
    </div>
  );
}