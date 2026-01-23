import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue
if (typeof window !== 'undefined') {
  const iconDefault = L.Icon.Default;
  if (iconDefault && iconDefault.prototype && (iconDefault.prototype as any)._getIconUrl) {
    delete (iconDefault.prototype as any)._getIconUrl;

    iconDefault.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  }
}

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popup?: string;
    icon?: string;
    rotation?: number;
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  route?: [number, number][];
  recenterKey?: number; // New prop to force re-center
}

function MapUpdater({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.flyTo(center, 16, { // Updated to 16 per user request
        animate: true,
        duration: 1.5
      });
    }
  }, [center, map, recenterKey]);

  return null;
}

function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) {
        onClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

import { renderToStaticMarkup } from "react-dom/server";
import { Car, MapPin, User, Navigation } from "lucide-react";

function MapMarkers({ markers }: { markers: MapProps['markers'] }) {
  if (!markers || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker, index) => {
        let iconHtml = "";
        let className = "custom-marker-icon";
        const iconSize: [number, number] = [40, 40];
        let anchor: [number, number] = [20, 20];

        // Determine icon based on marker.icon or fallback
        // 3D Car Marker Implementation
        if (marker.icon === "🚗" || marker.icon === "car") {
          iconHtml = renderToStaticMarkup(
            <div
              className="car-marker-container"
              style={{
                transform: `rotate(${marker.rotation || 0}deg)`,
                transition: "transform 0.5s ease-in-out"
              }}
            >
              <div style={{ fontSize: '32px', lineHeight: '1', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                🚖
              </div>
            </div>
          );
        } else if (marker.icon === "🧍" || marker.icon === "user") {
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-lg border-2 border-gray-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse absolute -top-1 -right-1" />
              <User className="w-4 h-4 text-black" />
            </div>
          );
        } else if (marker.icon === "📍" || marker.icon === "pin") {
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
              <MapPin className="w-10 h-10 text-[#84cc16] fill-black drop-shadow-lg" />
              <div className="absolute bottom-0 w-3 h-1 bg-black/50 blur-[2px] rounded-full" />
            </div>
          );
          anchor = [20, 38]; // Bottom center for pin
        } else {
          // Fallback for custom text/emoji
          iconHtml = `<div style="font-size: 32px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${marker.icon}</div>`;
        }

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'bg-transparent border-none', // Override default Leaflet divIcon styles
          iconSize: iconSize,
          iconAnchor: anchor,
        });

        return (
          <Marker
            key={`marker-${marker.position[0]}-${marker.position[1]}-${index}`}
            position={marker.position}
            icon={customIcon}
          >
            {marker.popup && <Popup className="custom-popup">{marker.popup}</Popup>}
          </Marker>
        );
      })}
    </>
  );
}

// Helper function to fetch route from OSRM
async function getRoadRoute(start: [number, number], end: [number, number]) {
  const startStr = `${start[1]},${start[0]}`;
  const endStr = `${end[1]},${end[0]}`;

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`
    );

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error("No route found");
      return null;
    }

    // OSRM returns [lng, lat], we need to flip back to [lat, lng] for Leaflet
    return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
  } catch (error) {
    console.error("Error fetching route:", error);
    return null;
  }
}


function RecenterControl({ center, onRecenter }: { center: [number, number], onRecenter: () => void }) {
  const map = useMap();
  const [showButton, setShowButton] = useState(false);
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);

  // Monitor move events to detect manual dragging
  useMapEvents({
    movestart: () => {
      // If we are flying to a location, we shouldn't show the button immediately
    },
    moveend: () => {
      if (!isProgrammaticMove) {
        // Simple distance check could be added here, but for now show on any manual move
        const mapCenter = map.getCenter();
        const dist = Math.sqrt(Math.pow(mapCenter.lat - center[0], 2) + Math.pow(mapCenter.lng - center[1], 2));
        if (dist > 0.001) { // Threshold to prevent showing on micro-movements
          setShowButton(true);
        }
      }
      setIsProgrammaticMove(false);
    }
  });

  // Listen to center prop changes to hide button when parent updates location (e.g. driving mode)
  useEffect(() => {
    setIsProgrammaticMove(true);
    map.flyTo(center, 15, { animate: true, duration: 1.5 });
    setShowButton(false);
  }, [center, map]);

  const handleRecenter = () => {
    setIsProgrammaticMove(true);
    map.flyTo(center, 15, { animate: true, duration: 1 });
    setShowButton(false);
    onRecenter();
  };

  if (!showButton) return null;

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: "100px", marginRight: "16px", pointerEvents: "auto" }}>
      <div className="leaflet-control">
        <button
          onClick={handleRecenter}
          className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-[#84cc16]/50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center justify-center hover:bg-[#252525] active:scale-95 transition-all duration-300 z-[1000] group"
        >
          <Navigation className="w-5 h-5 text-[#84cc16] fill-[#84cc16]/20 group-hover:rotate-45 transition-transform duration-300" />
        </button>
      </div>
    </div>
  );
}

const Map = ({ center, zoom = 13, markers = [], onMapClick, route, recenterKey }: MapProps) => {
  const [enhancedRoute, setEnhancedRoute] = useState<[number, number][] | null>(null);

  const start = route && route.length === 2 ? route[0] : null;
  const end = route && route.length === 2 ? route[1] : null;

  useEffect(() => {
    if (start && end) {
      getRoadRoute(start, end).then((path) => {
        if (path) setEnhancedRoute(path);
      });
    } else {
      setEnhancedRoute(null);
    }
  }, [start?.[0], start?.[1], end?.[0], end?.[1]]);

  const displayRoute = enhancedRoute || route;

  if (!center || isNaN(center[0]) || isNaN(center[1])) {
    console.warn("Map received invalid center:", center);
    return null; // Don't render map with invalid center
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg relative">
      <div style={{ height: "100%", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%", background: '#242424' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; Google Maps'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            className="dark-map-tiles"
          />
          {/* We replace simplified MapUpdater with the smarter RecenterControl */}
          <RecenterControl center={center} onRecenter={() => { }} />

          {onMapClick && <MapClickHandler onClick={onMapClick} />}
          <MapMarkers markers={markers} />
          {displayRoute && displayRoute.length > 0 && (
            <Polyline
              positions={displayRoute}
              color="#3b82f6"
              weight={6}
              opacity={0.9}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default Map;
