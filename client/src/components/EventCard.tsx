import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { EventWithDetails } from "@shared/schema";

interface EventCardProps {
  event: EventWithDetails;
  onClick: () => void;
}

export default function EventCard({ event, onClick }: EventCardProps) {
  const formatDate = (date: string) => {
    const eventDate = new Date(date);
    return eventDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).toUpperCase();
  };

  const formatTime = (date: string) => {
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
    <div
      className="event-card bg-card rounded-2xl overflow-hidden shadow-lg border border-border cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-xl"
      onClick={onClick}
      data-testid={`card-event-${event.id}`}
    >
      {/* Event cover image */}
      <div 
        className="relative h-48 bg-cover bg-center"
        style={{
          backgroundImage: event.coverImageUrl 
            ? `url(${event.coverImageUrl})` 
            : "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400')"
        }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute top-4 left-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1">
            <p className="text-xs font-semibold text-foreground" data-testid={`text-event-day-${event.id}`}>
              {formatDate(event.dateTime.toString()).split(' ')[0]}
            </p>
            <p className="text-xs text-muted-foreground" data-testid={`text-event-month-${event.id}`}>
              {formatDate(event.dateTime.toString()).split(' ')[1]}
            </p>
          </div>
        </div>
        <div className="absolute top-4 right-4">
          <button className="bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition-colors">
            <i 
              className={`${event.userAttendance?.status === 'attending' ? 'fas fa-heart text-primary' : 'far fa-heart text-muted-foreground'}`}
            ></i>
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Badge className={`text-xs ${getCategoryColor(event.category)}`}>
            <i className={`${getCategoryIcon(event.category)} mr-1`}></i>
            {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
          </Badge>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs" data-testid={`text-event-distance-${event.id}`}>
            <i className="fas fa-map-marker-alt mr-1"></i>
            {event.distance ? `${event.distance.toFixed(1)} km` : 'N/A'}
          </span>
        </div>
        
        <h4 className="font-semibold text-foreground text-lg mb-1" data-testid={`text-event-title-${event.id}`}>
          {event.title}
        </h4>
        <p className="text-muted-foreground text-sm mb-3" data-testid={`text-event-datetime-${event.id}`}>
          {new Date(event.dateTime).toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })} • {formatTime(event.dateTime.toString())}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <div className="flex -space-x-2">
              {/* Show organizer avatar and some placeholder attendees */}
              <Avatar className="w-6 h-6 border-2 border-white">
                <AvatarImage src={event.organizer.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {event.organizer.firstName?.[0]}{event.organizer.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {[...Array(Math.min(2, Math.max(0, event.attendanceCount - 1)))].map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-muted"></div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground ml-2" data-testid={`text-event-attendees-${event.id}`}>
              +{event.attendanceCount} confirmados
            </span>
          </div>
          <span className="text-primary font-semibold" data-testid={`text-event-price-${event.id}`}>
            {!event.price || event.price === "0" ? 'Gratuito' : `R$ ${event.price}`}
          </span>
        </div>
      </div>
    </div>
  );
}
