import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Car, MapPin, User, Navigation } from "lucide-react";

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
  recenterKey?: number;
}

// Custom Hook to manage Map Center logic without "fighting" user
function MapController({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  const map = useMap();
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [showRecenterBtn, setShowRecenterBtn] = useState(false);
  const lastCenter = useRef<[number, number]>(center);

  // Detect manual interactions
  useMapEvents({
    dragstart: () => {
      setIsUserInteracting(true);
      setShowRecenterBtn(true);
    },
    zoomstart: () => {
      setIsUserInteracting(true);
      setShowRecenterBtn(true);
    }
  });

  // Handle programmatic updates (GPS updates)
  useEffect(() => {
    // If user is NOT interacting, we can auto-follow.
    // BUT to avoid excessive jitter, usually we only flyTo if distance is significant OR it's a forced recenter.

    // Logic: If user hasn't touched the map, keep centered on driver (GPS).
    if (!isUserInteracting) {
      map.flyTo(center, 16, { animate: true, duration: 1.5 });
    }
  }, [center, map, isUserInteracting]);

  // Handle Forced Recenter (from Prop or Button)
  useEffect(() => {
    if (recenterKey) {
      handleRecenter();
    }
  }, [recenterKey]);

  const handleRecenter = () => {
    setIsUserInteracting(false); // Reset interaction flag
    setShowRecenterBtn(false);
    map.flyTo(center, 16, { animate: true, duration: 1 });
  };

  if (!showRecenterBtn) return null;

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: "100px", marginRight: "16px", pointerEvents: "auto", zIndex: 1000 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRecenter();
        }}
        className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-[#84cc16]/50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center justify-center hover:bg-[#252525] active:scale-95 transition-all duration-300 group"
      >
        <Navigation className="w-5 h-5 text-[#84cc16] fill-[#84cc16]/20 group-hover:rotate-45 transition-transform duration-300" />
      </button>
    </div>
  );
}

// Bounds Fitter Component - Runs ONCE on mount or Major Route Change
function RouteBoundsFitter({ route }: { route?: [number, number][] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (route && route.length > 1 && !hasFitted.current) {
      const bounds = L.latLngBounds(route);
      if (bounds.isValid()) {
        console.log("Fitting bounds for route...");
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true
        });
        hasFitted.current = true; // Mark as fitted so we don't fight user later
      }
    }
  }, [route, map]);

  return null;
}

function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick && onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapMarkers({ markers }: { markers: MapProps['markers'] }) {
  if (!markers || markers.length === 0) return null;

  return (
    <>
      {markers.map((marker, index) => {
        let iconHtml = "";
        const iconSize: [number, number] = [40, 40];
        let anchor: [number, number] = [20, 20];

        if (marker.icon === "🚗" || marker.icon === "car") {
          iconHtml = renderToStaticMarkup(
            <div className="car-marker-container" style={{ transform: `rotate(${marker.rotation || 0}deg)`, transition: "transform 0.5s ease-in-out" }}>
              <div style={{ fontSize: '32px', lineHeight: '1', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>🚖</div>
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
          anchor = [20, 38];
        } else {
          iconHtml = `<div style="font-size: 32px; text-align: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${marker.icon}</div>`;
        }

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'bg-transparent border-none',
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

// Fetch OSRM Route
async function getRoadRoute(start: [number, number], end: [number, number]) {
  const startStr = `${start[1]},${start[0]}`;
  const endStr = `${end[1]},${end[0]}`;
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`);
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) return null;
    return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
  } catch (error) {
    return null;
  }
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

  const displayRoute = enhancedRoute || ((route && route.length > 2) ? route : null);

  if (!center || isNaN(center[0]) || isNaN(center[1])) return null;

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg relative">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", background: '#242424' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          className="dark-map-tiles"
        />

        {/* Smarter Controls that don't fight user */}
        <MapController center={center} recenterKey={recenterKey} />
        <RouteBoundsFitter route={displayRoute || undefined} />

        {onMapClick && <MapClickHandler onClick={onMapClick} />}
        <MapMarkers markers={markers} />

        {displayRoute && displayRoute.length > 0 && (
          <Polyline
            positions={displayRoute}
            pathOptions={{ color: "#22c55e", weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;
