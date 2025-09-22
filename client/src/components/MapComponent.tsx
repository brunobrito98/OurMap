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

  // Set Mapbox access token
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  
  if (!mapboxToken) {
    console.error('VITE_MAPBOX_ACCESS_TOKEN não encontrado');
  } else {
    mapboxgl.accessToken = mapboxToken;
  }
  
  // If no access token, render fallback placeholder directly
  if (!mapboxToken) {
    return (
      <div 
        style={{ height: `${height}px` }}
        className="w-full rounded-xl overflow-hidden"
        data-testid="map-component"
      >
        <div className="w-full h-full bg-secondary rounded-xl flex items-center justify-center border border-border">
          <div className="text-center p-4">
            <i className="fas fa-map text-2xl text-muted-foreground mb-2"></i>
            <p className="text-sm text-muted-foreground">Mapa Interativo</p>
            {address && <p className="text-xs text-muted-foreground mt-1">{address}</p>}
            {draggableMarker && <p className="text-xs text-muted-foreground mt-1">Clique para definir localização</p>}
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    let isMounted = true;
    let mapInitialized = false;

    try {
      // Check if container is still available
      if (!mapContainer.current || mapContainer.current.children.length > 0) {
        return;
      }

      // Initialize map with error handling
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [longitude, latitude],
        zoom: 15,
        attributionControl: false,
        // Add specific configurations for Replit environment
        transformRequest: (url, resourceType) => {
          // Handle mapbox requests properly in Replit environment
          if (!isMounted) {
            // If component is unmounted, abort request
            return null;
          }
          return { url: url };
        }
      });

      mapInitialized = true;

      // Add error handling for map load
      map.current.on('error', (e: any) => {
        if (isMounted) {
          // Suppress common network-related errors that don't affect functionality
          if (e?.type === 'error' && e?.error?.message?.includes('aborted')) {
            console.warn('Mapbox request aborted (component unmounted)');
            return;
          }
          console.error('Mapbox map error:', e);
        }
      });

      // Add load event to ensure map is ready
      map.current.on('load', () => {
        if (!isMounted) {
          try {
            map.current?.remove();
          } catch (e) {
            // Ignore cleanup errors
          }
          return;
        }
      });
    } catch (error) {
      console.error('Error initializing Mapbox map:', error);
      return;
    }

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
      isMounted = false;
      
      // Cleanup marker first
      try {
        if (marker.current) {
          marker.current.remove();
          marker.current = null;
        }
      } catch (error) {
        // Silent cleanup - don't log unnecessary warnings
      }
      
      // Cleanup map with improved error handling
      try {
        if (map.current) {
          // Remove all event listeners first to prevent callback errors
          map.current.off();
          
          // Force immediate removal without waiting for style load
          map.current.remove();
          map.current = null;
        }
      } catch (error) {
        // Silent cleanup - many errors during unmount are harmless
        try {
          // Force cleanup even if remove() failed
          if (map.current) {
            map.current = null;
          }
        } catch (e) {
          // Ignore nested cleanup errors
        }
      }
      
      // Clear container if it exists
      try {
        if (mapContainer.current) {
          mapContainer.current.innerHTML = '';
        }
      } catch (error) {
        // Ignore container cleanup errors
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
