import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin, User, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Leaflet Icon Fix ---
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

// === MEMOIZED MARKERS ===
const MapMarkers = memo(({ markers }: { markers: MapProps['markers'] }) => {
  if (!markers?.length) return null;
  return (
    <>
      {markers.map((marker, i) => {
        const key = `${marker.position[0]}-${marker.position[1]}-${marker.icon}`;
        let iconHtml = "";
        let anchor: [number, number] = [20, 20];

        if (marker.icon === "🚗" || marker.icon === "car") {
          iconHtml = renderToStaticMarkup(
            <div className="relative" style={{ transform: `rotate(${marker.rotation || 0}deg)`, transition: "transform 0.5s ease-in-out" }}>
              {/* Glow effect for visibility on dark map */}
              <div className="absolute inset-0 bg-[#84cc16]/40 blur-lg rounded-full transform scale-150" />
              <div className="relative text-[36px] filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">🚖</div>
            </div>
          );
        } else if (marker.icon === "📍" || marker.icon === "pin") {
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
              <MapPin className="w-10 h-10 text-[#84cc16] fill-black drop-shadow-lg" />
            </div>
          );
          anchor = [20, 38];
        } else {
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-lg border-2 border-gray-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse absolute -top-1 -right-1" />
              <User className="w-4 h-4 text-black" />
            </div>
          );
        }

        return <Marker key={key} position={marker.position} icon={L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [40, 40], iconAnchor: anchor })} >
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      })}
    </>
  )
}, (prev, next) => {
  return JSON.stringify(prev.markers) === JSON.stringify(next.markers);
});

// === MEMOIZED POLYLINE ===
const MapPolyline = memo(({ positions }: { positions: [number, number][] }) => {
  return <Polyline positions={positions} pathOptions={{ color: "#22c55e", weight: 6, opacity: 0.9 }} />
}, (prev, next) => {
  // Basic check first/last pt
  if (prev.positions.length !== next.positions.length) return false;
  return prev.positions[0] === next.positions[0] && prev.positions[prev.positions.length - 1] === next.positions[next.positions.length - 1];
});

// ===CLICK HANDLER (Restored)===
function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick && onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// === MAP CONTROLLER ===
function MapController({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  const map = useMap();
  const [isLocked, setIsLocked] = useState(true);
  const isLockedRef = useRef(true);
  // We track if we are currently "flying" or "panning" automatically
  const isAutoMovingRef = useRef(false);
  const autoRecenterTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoRecenterChange = () => {
    if (autoRecenterTimerRef.current) {
      clearTimeout(autoRecenterTimerRef.current);
      autoRecenterTimerRef.current = null;
    }
  };

  const startAutoRecenterTimer = () => {
    clearAutoRecenterChange();
    autoRecenterTimerRef.current = setTimeout(() => {
      // Auto-recenter after 10 seconds of no interaction
      if (!isLockedRef.current) {
        handleRecenter();
      }
    }, 10000); // 10 seconds
  };

  // Interaction handlers to UNLOCK the map
  useMapEvents({
    dragstart: () => {
      isLockedRef.current = false;
      setIsLocked(false);
      clearAutoRecenterChange();
    },
    zoomstart: () => {
      isLockedRef.current = false;
      setIsLocked(false);
      clearAutoRecenterChange();
    },
    dragend: () => {
      startAutoRecenterTimer();
    },
    zoomend: () => {
      startAutoRecenterTimer();
    }
  });

  // Watch for Center updates (GPS moving)
  useEffect(() => {
    if (isLockedRef.current && center) {
      isAutoMovingRef.current = true;
      map.panTo(center, { animate: true, duration: 1.0 });
    }
  }, [center, map]);

  const handleRecenter = useCallback(() => {
    isLockedRef.current = true;
    setIsLocked(true);
    clearAutoRecenterChange();
    map.flyTo(center, 16, { animate: true, duration: 1 });
  }, [center, map]);

  useEffect(() => {
    if (recenterKey) handleRecenter();
  }, [recenterKey, handleRecenter]);

  return (
    <div
      className={cn(
        "leaflet-bottom leaflet-right transition-opacity duration-300",
        isLocked ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      )}
      style={{ marginBottom: "350px", marginRight: "16px", zIndex: 4000 }}
    >
      <div className="absolute -top-12 right-0"> {/* Label or hint could go here */} </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRecenter();
        }}
        className="w-12 h-12 rounded-full border-2 border-[#84cc16] shadow-[0_4px_20px_rgba(0,0,0,0.6)] bg-[#1A1A1A] text-[#84cc16] flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-[#84cc16] hover:text-black"
        title="Re-center"
      >
        <Navigation className="w-6 h-6 fill-current" />
      </button>
    </div>
  );
}

// === MAIN COMPONENT ===
async function getRoadRoute(start: [number, number], end: [number, number]) {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
    const data = await res.json();
    return data.routes?.[0]?.geometry?.coordinates?.map((c: number[]) => [c[1], c[0]]) as [number, number][] || null;
  } catch { return null; }
}

const Map = ({ center, zoom = 13, markers = [], onMapClick, route, recenterKey }: MapProps) => {
  const [enhancedRoute, setEnhancedRoute] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (route?.length === 2 && route[0] && route[1]) {
      if (route[0][0] !== 0 && route[1][0] !== 0) {
        getRoadRoute(route[0], route[1]).then(path => {
          if (path) setEnhancedRoute(path);
        });
      }
    } else {
      setEnhancedRoute(null);
    }
  }, [route?.[0]?.[0], route?.[1]?.[0]]);

  const memoMarkers = useMemo(() => markers, [JSON.stringify(markers)]);
  // Fallback to straight line if API fails or while loading
  const displayRoute = enhancedRoute || (route?.length && route.length >= 2 ? route : null);
  const memoRoute = useMemo(() => displayRoute, [JSON.stringify(displayRoute)]);

  if (!center) return null;

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg relative bg-[#242424]">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          className="dark-map-tiles"
        />

        <MapController center={center} recenterKey={recenterKey} />
        {onMapClick && <MapClickHandler onClick={onMapClick} />}
        <MapMarkers markers={memoMarkers} />
        {memoRoute && <MapPolyline positions={memoRoute} />}
      </MapContainer>
    </div>
  );
};

export default Map;
