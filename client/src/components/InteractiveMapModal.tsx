import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Check, X, Loader2, Navigation } from "lucide-react";
import MapComponent from "./MapComponent";

interface InteractiveMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

export default function InteractiveMapModal({
  open,
  onOpenChange,
  onLocationSelect,
  initialLat = -23.5505,
  initialLng = -46.6333,
  initialAddress = ""
}: InteractiveMapModalProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat);
  const [selectedLng, setSelectedLng] = useState(initialLng);
  const [searchAddress, setSearchAddress] = useState(initialAddress);
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Reset state when modal opens and get user location
  useEffect(() => {
    if (open) {
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
      setSearchAddress(initialAddress);
      
      // Auto-detect user location when modal opens
      getUserLocation();
    }
  }, [open, initialLat, initialLng, initialAddress]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser.');
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLat(latitude);
        setSelectedLng(longitude);
        
        // Get address for the detected location
        reverseGeocode(latitude, longitude);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting user location:', error);
        setIsGettingLocation(false);
        
        // Fallback to default location or keep current
        // No need to show error to user, just use default location
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    
    // Try to get address from coordinates
    reverseGeocode(lat, lng);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch('/api/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchAddress(data.address || '');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  const handleAddressSearch = async () => {
    if (!searchAddress.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: searchAddress })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedLat(data.lat);
        setSelectedLng(data.lng);
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLat, selectedLng, searchAddress);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Selecionar Localização do Evento
            {isGettingLocation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Detectando sua localização...
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Address Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Digite um endereço para buscar..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                data-testid="input-map-search"
              />
            </div>
            <Button 
              onClick={handleAddressSearch}
              disabled={isSearching || !searchAddress.trim()}
              variant="outline"
              size="icon"
              data-testid="button-map-search"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button 
              onClick={getUserLocation}
              disabled={isGettingLocation}
              variant="outline"
              size="icon"
              title="Buscar minha localização"
              data-testid="button-get-location"
            >
              {isGettingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Map Container */}
          <div className="rounded-xl overflow-hidden border">
            <MapComponent
              latitude={selectedLat}
              longitude={selectedLng}
              height={400}
              showMarker
              draggableMarker
              onMarkerDrag={handleMapClick}
              onClick={handleMapClick}
            />
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Como usar:</strong>
            </p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1">
              <li>• Sua localização atual é detectada automaticamente</li>
              <li>• Use o botão 📍 para buscar sua localização novamente</li>
              <li>• Digite um endereço na barra de busca ou</li>
              <li>• Clique diretamente no mapa para marcar a localização</li>
              <li>• Arraste o marcador azul para ajustar a posição</li>
            </ul>
          </div>

          {/* Selected coordinates info */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-sm font-medium">Localização Selecionada:</p>
            <p className="text-xs text-muted-foreground">
              <strong>Endereço:</strong> {searchAddress || 'Endereço não encontrado'}
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Coordenadas:</strong> {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              data-testid="button-map-cancel"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              data-testid="button-map-confirm"
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Localização
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}