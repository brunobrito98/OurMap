import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/hooks/useAuth";
import type { EventWithDetails } from "@shared/schema";
import { ArrowLeft, Plus } from "lucide-react";

export default function MyEvents() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery<EventWithDetails[]>({
    queryKey: ['/api/events/my-events'],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate("/profile")}
              variant="ghost"
              size="sm"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold text-foreground flex-1">Meus Eventos</h2>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-muted rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate("/profile")}
            variant="ghost"
            size="sm"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold text-foreground flex-1">Meus Eventos</h2>
          <Button
            onClick={() => navigate("/create")}
            variant="ghost"
            size="sm"
            data-testid="button-create-event"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
              <i className="fas fa-calendar-alt text-primary text-2xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum evento criado
            </h3>
            <p className="text-muted-foreground mb-6">
              Você ainda não criou nenhum evento. Que tal começar agora?
            </p>
            <Button
              onClick={() => navigate("/create")}
              className="bg-primary text-primary-foreground"
              data-testid="button-create-first-event"
            >
              <i className="fas fa-plus mr-2"></i>
              Criar Primeiro Evento
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground" data-testid="text-events-count">
                {events.length} evento{events.length !== 1 ? 's' : ''} criado{events.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => navigate(`/event/${event.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}