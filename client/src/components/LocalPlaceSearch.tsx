import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchIcon, MapPinIcon, LoaderIcon, NavigationIcon } from "lucide-react";

interface LocalPlaceSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlaceSelect: (place: LocalPlace) => void;
  userLocation: { lat: number; lng: number } | null;
  currentCity: string;
}

interface LocalPlace {
  place_name: string;
  center: [number, number];
  text: string;
  category: string;
  address: string;
}

export default function LocalPlaceSearch({ 
  open, 
  onOpenChange, 
  onPlaceSelect,
  userLocation,
  currentCity
}: LocalPlaceSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [places, setPlaces] = useState<LocalPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search for local places
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim().length < 2 || !userLocation) {
      setPlaces([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/search-places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: searchQuery,
            proximity: userLocation
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setPlaces(data.places || []);
        } else {
          setPlaces([]);
        }
      } catch (error) {
        console.error("Error searching local places:", error);
        setPlaces([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    setSearchTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery, userLocation]);

  const handlePlaceSelect = (place: LocalPlace) => {
    onPlaceSelect(place);
    onOpenChange(false);
    setSearchQuery("");
    setPlaces([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (places.length > 0) {
        handlePlaceSelect(places[0]);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NavigationIcon className="w-5 h-5 text-primary" />
            Buscar Local em {currentCity}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinIcon className="w-4 h-4" />
              <span>Buscando lugares próximos em {currentCity}</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <Input
                type="text"
                placeholder="Ex: beira rio, restaurante, parque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                data-testid="input-place-search"
              />
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isLoading && (
                <LoaderIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {places.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {places.map((place, index) => (
                  <div
                    key={index}
                    onClick={() => handlePlaceSelect(place)}
                    className="px-4 py-3 hover:bg-secondary cursor-pointer border-b border-border last:border-b-0"
                    data-testid={`place-suggestion-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{place.text}</p>
                        <p className="text-xs text-muted-foreground">{place.address}</p>
                        {place.category && (
                          <p className="text-xs text-primary">{place.category}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-cancel-place-search"
            >
              Cancelar
            </Button>
          </div>

          {!userLocation && (
            <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              <p>Para buscar lugares locais, permita o acesso à sua localização.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}