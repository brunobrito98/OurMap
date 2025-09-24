import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EventCard from "@/components/EventCard";
import CategoryFilter from "@/components/CategoryFilter";
import BottomNavigation from "@/components/BottomNavigation";
import FloatingCreateButton from "@/components/FloatingCreateButton";
import CitySearchModal from "@/components/CitySearchModal";
import { MapPin, Search, ArrowUpDown, CalendarX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { EventWithDetails } from "@shared/schema";

export default function Home() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("São Paulo, SP");
  const [userCity, setUserCity] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          
          // Reverse geocode to get location name and city
          fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(location),
          })
            .then(res => res.json())
            .then(data => {
              if (data.address) {
                setLocationName(data.address);
              }
              if (data.city) {
                setUserCity(data.city);
              }
            })
            .catch(console.error);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const { data: events = [], isLoading } = useQuery<EventWithDetails[]>({
    queryKey: ['/api/events', selectedCategory, userCity],
    queryFn: async ({ queryKey }) => {
      const [, category, city] = queryKey;
      const params = new URLSearchParams();
      if (category) params.set('category', category as string);
      if (city) params.set('city', city as string);
      
      const response = await fetch(`/api/events?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  const filteredEvents = events.filter(event => 
    !searchQuery || event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLocationSelect = (location: { lat: number; lng: number }, cityName: string) => {
    setUserLocation(location);
    setLocationName(cityName);
    
    // Extract just the city name from full address for filtering
    const cityOnly = cityName.split(',')[0].trim();
    setUserCity(cityOnly);
  };

  const handleChangeLocation = () => {
    setIsLocationModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with Location */}
      <div className="bg-white border-b border-border p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Sua localização</p>
              <p className="font-semibold text-foreground" data-testid="text-location">{locationName}</p>
            </div>
          </div>
          <Button
            onClick={handleChangeLocation}
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-secondary"
            data-testid="button-change-location"
          >
            <MapPin className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white">
        <div className="relative">
          <Input
            type="text"
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-0 h-12"
            data-testid="input-search"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-4 pb-4">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Events Feed */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Eventos próximos</h3>
          <div className="flex space-x-2">
            <button className="text-primary text-sm font-medium flex items-center" data-testid="button-sort-distance">
              <ArrowUpDown className="w-4 h-4 mr-1" />Distância
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <CalendarX className="w-16 h-16 text-muted-foreground mb-4 mx-auto" />
            <p className="text-muted-foreground">
              {searchQuery ? "Nenhum evento encontrado" : "Nenhum evento disponível"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={() => navigate(`/event/${event.id}`)}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botão de criar evento - apenas para usuários logados */}
      {isAuthenticated && <FloatingCreateButton />}
      
      <BottomNavigation activeTab="home" />
      
      <CitySearchModal
        open={isLocationModalOpen}
        onOpenChange={setIsLocationModalOpen}
        onLocationSelect={handleLocationSelect}
        currentLocation={locationName}
      />
    </div>
  );
}
