import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

    // Set Mapbox access token
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxgl.accessToken) {
      // Fallback to a simple placeholder if no token
      mapContainer.current.innerHTML = `
        <div class="w-full h-full bg-secondary rounded-xl flex items-center justify-center border border-border">
          <div class="text-center p-4">
            <i class="fas fa-map text-2xl text-muted-foreground mb-2"></i>
            <p class="text-sm text-muted-foreground">Mapa Interativo</p>
            ${address ? `<p class="text-xs text-muted-foreground mt-1">${address}</p>` : ''}
            ${draggableMarker ? `<p class="text-xs text-muted-foreground mt-1">Clique para definir localização</p>` : ''}
          </div>
        </div>
      `;
      return;
    }

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 15,
      attributionControl: false,
    });

    // Add marker if requested
    if (showMarker) {
      marker.current = new mapboxgl.Marker({
        draggable: draggableMarker,
        color: draggableMarker ? '#3b82f6' : '#ef4444',
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

    // Add click handler if provided
    if (onClick) {
      map.current.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        onClick(lat, lng);
        
        if (marker.current) {
          marker.current.setLngLat([lng, lat]);
        } else if (showMarker) {
          // Create marker on click if none exists
          marker.current = new mapboxgl.Marker({
            draggable: draggableMarker,
            color: '#3b82f6',
          })
            .setLngLat([lng, lat])
            .addTo(map.current);
            
          if (draggableMarker && onMarkerDrag) {
            marker.current.on('dragend', () => {
              const lngLat = marker.current.getLngLat();
              onMarkerDrag(lngLat.lat, lngLat.lng);
            });
          }
        }
      });
    }

    // Clean up on unmount
    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
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
