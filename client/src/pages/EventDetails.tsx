import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import MapComponent from "@/components/MapComponent";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { EventWithDetails } from "@shared/schema";
import EventRatingForm from "@/components/EventRatingForm";
import Rating from "@/components/ui/rating";
import OrganizerRating from "@/components/OrganizerRating";
import EventRatingsDisplay from "@/components/EventRatingsDisplay";

export default function EventDetails() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery<EventWithDetails>({
    queryKey: ['/api/events', id],
    enabled: !!id,
  });

  // Fetch attendees with their profile photos
  const { data: attendees = [] } = useQuery<any[]>({
    queryKey: ['/api/events', id, 'attendees'],
    enabled: !!id,
  });

  const handleAttendanceAction = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login necessário",
        description: "Faça login para confirmar sua presença no evento!",
        variant: "destructive",
      });
        setTimeout(() => {
          const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.href = `/login?redirect=${encodeURIComponent(fullPath)}`;
        }, 500);
      return;
    }
    
    // Se autenticado, procede com a mutation
    attendMutation.mutate(isConfirmed ? 'not_going' : 'attending');
  };

  const attendMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest('POST', `/api/events/${id}/attend`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/events', id, 'attendees'] });
      toast({
        title: "Sucesso",
        description: "Sua confirmação foi atualizada!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.href = `/login?redirect=${encodeURIComponent(fullPath)}`;
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Falha ao atualizar confirmação",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-64 bg-muted"></div>
          <div className="p-4 space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-calendar-times text-4xl text-muted-foreground mb-4"></i>
          <p className="text-muted-foreground">Evento não encontrado</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const isOrganizer = Boolean(user && typeof user === 'object' && user !== null && 'id' in user && user.id === event?.organizer?.id);
  const userAttendance = event.userAttendance?.status;
  const isConfirmed = userAttendance === 'attending';

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      music: 'fas fa-music',
      food: 'fas fa-utensils',
      sports: 'fas fa-running',
      art: 'fas fa-palette',
      tech: 'fas fa-laptop-code',
    };
    return icons[category] || 'fas fa-calendar';
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Navigation Buttons */}
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
            <h2 className="font-semibold text-foreground">Detalhes do Evento</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              size="sm"
              data-testid="button-home"
              title="Ir para início"
            >
              <i className="fas fa-home text-xl"></i>
            </Button>
            {isOrganizer && (
              <Button
                onClick={() => navigate(`/edit/${event.id}`)}
                variant="ghost"
                size="sm"
                data-testid="button-edit"
                title="Editar evento"
              >
                <i className="fas fa-edit text-xl"></i>
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              data-testid="button-share"
              title="Compartilhar"
            >
              <i className="fas fa-share text-xl"></i>
            </Button>
          </div>
        </div>
      </div>

      <div className="pb-20">
        {/* Event Hero Image */}
        <div 
          className="relative h-64 bg-cover bg-center"
          style={{
            backgroundImage: event.coverImageUrl 
              ? `url(${event.coverImageUrl})` 
              : "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600')"
          }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-event-title">
                {event.title}
              </h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 text-white/90">
                  <i className="fas fa-calendar text-sm"></i>
                  <span className="text-sm" data-testid="text-event-date">
                    {formatDate(event.dateTime)}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-white/90">
                  <i className="fas fa-clock text-sm"></i>
                  <span className="text-sm" data-testid="text-event-time">
                    {formatTime(event.dateTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="p-4">
          {/* Organizer */}
          <div className="flex items-center space-x-3 mb-6">
            <Avatar className="w-12 h-12">
              <AvatarImage src={event.organizer.profileImageUrl || undefined} />
              <AvatarFallback>
                {event.organizer.firstName?.[0]}{event.organizer.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-foreground" data-testid="text-organizer-name">
                {event.organizer.firstName} {event.organizer.lastName}
              </p>
              <p className="text-sm text-muted-foreground">Organizador</p>
            </div>
            <OrganizerRating organizerId={event.organizer.id} />
          </div>

          {/* Category and Distance */}
          <div className="flex items-center space-x-3 mb-6">
            <Badge className={getCategoryColor(event.category)}>
              <i className={`${getCategoryIcon(event.category)} mr-1`}></i>
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </Badge>
            {event.distance && (
              <>
                <span className="text-muted-foreground text-xs">•</span>
                <span className="text-muted-foreground text-xs" data-testid="text-event-distance">
                  <i className="fas fa-map-marker-alt mr-1"></i>
                  {event.distance.toFixed(1)} km
                </span>
              </>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h3 className="font-semibold text-foreground mb-3">Sobre o evento</h3>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-event-description">
                {event.description}
              </p>
            </div>
          )}

          {/* Location Card */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Localização</h3>
              {event.distance && (
                <span className="text-sm text-primary font-medium">
                  <i className="fas fa-map-marker-alt mr-1"></i>
                  {event.distance.toFixed(1)} km
                </span>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm mb-3" data-testid="text-event-address">
              {event.location}
            </p>
            
            {/* Interactive Map */}
            <div className="rounded-xl overflow-hidden mb-3">
              <MapComponent
                latitude={event.latitude ? parseFloat(event.latitude) : 0}
                longitude={event.longitude ? parseFloat(event.longitude) : 0}
                height={128}
                showMarker
                address={event.location}
              />
            </div>
            
            <Button
              className="w-full"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`, '_blank')}
              data-testid="button-directions"
            >
              <i className="fas fa-directions mr-2"></i>Como chegar
            </Button>
          </div>

          {/* Attendees */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">
                Confirmados ({event.attendanceCount})
              </h3>
              {attendees.length > 5 && (
                <button className="text-primary text-sm font-medium" data-testid="button-view-all-attendees">
                  Ver todos
                </button>
              )}
            </div>
            
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {attendees.slice(0, 5).map((attendee: any) => (
                <Avatar key={attendee.id} className="w-12 h-12 flex-shrink-0" data-testid={`avatar-attendee-${attendee.id}`}>
                  <AvatarImage src={attendee.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {attendee.firstName?.[0]}{attendee.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
              {attendees.length === 0 && event.attendanceCount > 0 && (
                <div className="flex items-center justify-center text-muted-foreground text-sm">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Carregando confirmados...
                </div>
              )}
            </div>
          </div>

          {/* Friends Going Section - apenas para usuários logados */}
          {isAuthenticated && event.friendsGoing && event.friendsGoing.length > 0 && (
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 mb-6">
              <div className="flex items-center space-x-2 mb-3">
                <i className="fas fa-users text-accent"></i>
                <h3 className="font-semibold text-foreground">Seus amigos vão</h3>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-2">
                  {event.friendsGoing.slice(0, 3).map((friend) => (
                    <Avatar key={friend.id} className="w-8 h-8 border-2 border-white">
                      <AvatarImage src={friend.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {friend.firstName?.[0]}{friend.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-friends-going">
                  {event.friendsGoing.map(f => f.firstName).join(", ")} 
                  {event.friendsGoing.length === 1 ? " confirmou" : " confirmaram"} presença
                </p>
              </div>
            </div>
          )}

          {/* Event Rating Section */}
          <EventRatingsDisplay eventId={event.id} />
          
          {/* Rating Form */}
          <EventRatingForm 
            eventId={event.id} 
            eventTitle={event.title}
            organizerName={`${event.organizer.firstName} ${event.organizer.lastName}`}
          />
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4">
        <div className="max-w-sm mx-auto flex items-center space-x-3">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-primary" data-testid="text-event-price">
              Gratuito
            </p>
            <p className="text-xs text-muted-foreground">
              Entrada livre
            </p>
          </div>
          <Button
            onClick={handleAttendanceAction}
            disabled={attendMutation.isPending}
            className={`flex-1 py-4 text-lg ${isConfirmed ? 'bg-green-600 hover:bg-green-700' : ''} ${
              !isAuthenticated ? 'opacity-90' : ''
            }`}
            data-testid="button-confirm-attendance"
          >
            {attendMutation.isPending ? (
              "Atualizando..."
            ) : isConfirmed ? (
              <>
                <i className="fas fa-check mr-2"></i>Confirmado
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>Confirmar Presença
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
