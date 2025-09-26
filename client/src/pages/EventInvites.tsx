import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Check, 
  X, 
  Mail,
  Loader2,
  Users,
  Home
} from "lucide-react";
import type { EventInvite, Event } from "@shared/schema";

type EventInviteWithEvent = EventInvite & { event: Event };

export default function EventInvites() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's pending event invites
  const { data: invites = [], isLoading } = useQuery<EventInviteWithEvent[]>({
    queryKey: ['/api/user/invites'],
    enabled: isAuthenticated,
  });

  // Respond to invite mutation
  const respondMutation = useMutation({
    mutationFn: async ({ inviteId, response }: { inviteId: string; response: 'accepted' | 'declined' }) => {
      return apiRequest(`/api/invites/${inviteId}/respond`, 'POST', { response });
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.response === 'accepted' ? "Convite aceito!" : "Convite recusado",
        description: variables.response === 'accepted' 
          ? "Você foi adicionado à lista de participantes do evento."
          : "O convite foi recusado.",
      });
      // Refresh invites list
      queryClient.invalidateQueries({ queryKey: ['/api/user/invites'] });
      // Also refresh events list in case user was added as attendee
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao responder convite",
        description: error.message || "Não foi possível responder ao convite. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      music: 'bg-purple-100 text-purple-700',
      food: 'bg-orange-100 text-orange-700',
      sports: 'bg-green-100 text-green-700',
      art: 'bg-pink-100 text-pink-700',
      tech: 'bg-blue-100 text-blue-700',
    };
    return colors[category] || 'bg-accent/10 text-accent';
  };

  const handleAcceptInvite = (inviteId: string) => {
    respondMutation.mutate({ inviteId, response: 'accepted' });
  };

  const handleDeclineInvite = (inviteId: string) => {
    respondMutation.mutate({ inviteId, response: 'declined' });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Login necessário</h1>
          <p className="text-muted-foreground mb-4">
            Faça login para ver seus convites de eventos.
          </p>
          <Button onClick={() => navigate('/login')}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Convites de Eventos</h1>
          </div>
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            size="sm"
            data-testid="button-home"
            title="Ir para início"
          >
            <Home className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2 text-lg">Carregando convites...</span>
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum convite pendente</h2>
            <p className="text-muted-foreground">
              Você não tem convites de eventos pendentes no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-lg font-medium text-foreground">
                Você tem {invites.length} convite{invites.length !== 1 ? 's' : ''} pendente{invites.length !== 1 ? 's' : ''}
              </h2>
            </div>
            
            {invites.map((invite) => (
              <Card key={invite.id} className="overflow-hidden">
                <div 
                  className="h-32 bg-cover bg-center relative"
                  style={{
                    backgroundImage: invite.event.coverImageUrl 
                      ? `url(${invite.event.coverImageUrl})` 
                      : "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400')"
                  }}
                >
                  <div className="absolute inset-0 bg-black/40"></div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-bold text-lg truncate" data-testid={`text-event-title-${invite.id}`}>
                      {invite.event.title}
                    </h3>
                  </div>
                </div>
                
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className={getCategoryColor(invite.event.category)}>
                      {invite.event.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Convite recebido em {formatDate(invite.createdAt || new Date().toISOString())}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {invite.event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {invite.event.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span data-testid={`text-event-date-${invite.id}`}>
                        {formatDate(invite.event.dateTime?.toString() || new Date().toISOString())}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span data-testid={`text-event-time-${invite.id}`}>
                        {formatTime(invite.event.dateTime?.toString() || new Date().toISOString())}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate" data-testid={`text-event-location-${invite.id}`}>
                        {invite.event.location}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-0">
                  <Button
                    variant="outline"
                    onClick={() => handleDeclineInvite(invite.id)}
                    disabled={respondMutation.isPending}
                    className="flex-1"
                    data-testid={`button-decline-${invite.id}`}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Recusar
                  </Button>
                  
                  <Button
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={respondMutation.isPending}
                    className="flex-1"
                    data-testid={`button-accept-${invite.id}`}
                  >
                    {respondMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Aceitar
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/events/${invite.event.id}`)}
                    title="Ver detalhes do evento"
                    data-testid={`button-view-event-${invite.id}`}
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}