import { useEffect, useRef } from 'react';

interface MapComponentProps {
  latitude: number;
  longitude: number;
  height?: number;
  showMarker?: boolean;
  draggableMarker?: boolean;
  onMarkerDrag?: (lat: number, lng: number) => void;
  onClick?: (lat: number, lng: number) => void;
  address?: string;
}

export default function MapComponent({
  latitude,
  longitude,
  height = 200,
  showMarker = false,
  draggableMarker = false,
  onMarkerDrag,
  onClick,
  address,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Check if Mapbox GL JS is available
    if (typeof window !== 'undefined' && (window as any).mapboxgl) {
      const mapboxgl = (window as any).mapboxgl;
      
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
      
      if (!mapboxgl.accessToken) {
        // Fallback to a simple placeholder if no token
        mapContainer.current.innerHTML = `
          <div class="w-full h-full bg-secondary rounded-xl flex items-center justify-center">
            <div class="text-center">
              <i class="fas fa-map text-2xl text-muted-foreground mb-2"></i>
              <p class="text-sm text-muted-foreground">Mapa Interativo</p>
              ${address ? `<p class="text-xs text-muted-foreground mt-1">${address}</p>` : ''}
            </div>
          </div>
        `;
        return;
      }

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 15,
      });

      if (showMarker) {
        marker.current = new mapboxgl.Marker({
          draggable: draggableMarker,
        })
          .setLngLat([longitude, latitude])
          .addTo(map.current);

        if (draggableMarker && onMarkerDrag) {
          marker.current.on('dragend', () => {
            const lngLat = marker.current.getLngLat();
            onMarkerDrag(lngLat.lat, lngLat.lng);
          });
        }
      }

      if (onClick) {
        map.current.on('click', (e: any) => {
          const { lng, lat } = e.lngLat;
          onClick(lat, lng);
          
          if (marker.current) {
            marker.current.setLngLat([lng, lat]);
          }
        });
      }

      // Clean up on unmount
      return () => {
        if (map.current) {
          map.current.remove();
        }
      };
    } else {
      // Fallback if Mapbox GL JS is not loaded
      mapContainer.current.innerHTML = `
        <div class="w-full h-full bg-secondary rounded-xl flex items-center justify-center">
          <div class="text-center">
            <i class="fas fa-map text-2xl text-muted-foreground mb-2"></i>
            <p class="text-sm text-muted-foreground">Mapa Interativo</p>
            ${address ? `<p class="text-xs text-muted-foreground mt-1">${address}</p>` : ''}
            ${draggableMarker ? `<p class="text-xs text-muted-foreground mt-1">Arraste o pin para definir localização</p>` : ''}
          </div>
        </div>
      `;
    }
  }, [latitude, longitude, showMarker, draggableMarker, onMarkerDrag, onClick, address]);

  // Update marker position when coordinates change
  useEffect(() => {
    if (marker.current && map.current) {
      marker.current.setLngLat([longitude, latitude]);
      map.current.setCenter([longitude, latitude]);
    }
  }, [latitude, longitude]);

  return (
    <div 
      ref={mapContainer} 
      style={{ height: `${height}px` }}
      className="w-full rounded-xl overflow-hidden"
      data-testid="map-component"
    />
  );
}
