import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapIcon, SearchIcon, MapPinIcon, LoaderIcon } from "lucide-react";

interface CitySearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: { lat: number; lng: number }, cityName: string) => void;
  currentLocation: string;
  userCoordinates?: { lat: number; lng: number } | null;
}

interface CitySuggestion {
  place_name: string;
  center: [number, number];
  text: string;
}

export default function CitySearchModal({ 
  open, 
  onOpenChange, 
  onLocationSelect, 
  currentLocation,
  userCoordinates 
}: CitySearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search for city suggestions
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Use Mapbox Search API for city suggestions with proximity filter
        const requestBody: any = { query: searchQuery };
        if (userCoordinates) {
          requestBody.proximity = userCoordinates;
        }
        
        const response = await fetch('/api/search-cities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Error searching cities:", error);
        setSuggestions([]);
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
  }, [searchQuery]);

  const handleCitySelect = async (suggestion: CitySuggestion) => {
    try {
      const [lng, lat] = suggestion.center;
      onLocationSelect({ lat, lng }, suggestion.place_name);
      onOpenChange(false);
      setSearchQuery("");
      setSuggestions([]);
    } catch (error) {
      console.error("Error selecting city:", error);
    }
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const requestBody: any = { address: searchQuery };
      if (userCoordinates) {
        requestBody.proximity = userCoordinates;
      }
      
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        const coordinates = await response.json();
        onLocationSelect(coordinates, searchQuery);
        onOpenChange(false);
        setSearchQuery("");
        setSuggestions([]);
      } else {
        alert("Cidade não encontrada. Tente novamente com um nome diferente.");
      }
    } catch (error) {
      console.error("Error geocoding city:", error);
      alert("Erro ao buscar cidade. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleCitySelect(suggestions[0]);
      } else {
        handleManualSearch();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-primary" />
            Mudar Cidade
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinIcon className="w-4 h-4" />
              <span>Localização atual: {currentLocation}</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <Input
                type="text"
                placeholder="Digite o nome da cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                data-testid="input-city-search"
              />
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isLoading && (
                <LoaderIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleCitySelect(suggestion)}
                    className="px-4 py-3 hover:bg-secondary cursor-pointer border-b border-border last:border-b-0"
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{suggestion.text}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.place_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleManualSearch}
              disabled={!searchQuery.trim() || isLoading}
              className="flex-1"
              data-testid="button-search-city"
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <SearchIcon className="w-4 h-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}