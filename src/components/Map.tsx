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
// Prevents re-rendering markers on every map move/GPS update unless data explicitly changes
const MapMarkers = memo(({ markers }: { markers: MapProps['markers'] }) => {
  if (!markers?.length) return null;
  return (
    <>
      {markers.map((marker, i) => {
        // Create stable key based on position to avoid index-based flicker
        const key = `${marker.position[0]}-${marker.position[1]}-${marker.icon}`;

        let iconHtml = "";
        let anchor: [number, number] = [20, 20];

        if (marker.icon === "🚗" || marker.icon === "car") {
          iconHtml = renderToStaticMarkup(
            <div style={{ transform: `rotate(${marker.rotation || 0}deg)`, transition: "transform 0.5s ease-in-out" }}>
              <div style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>🚖</div>
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
  // Custom comparison for performance
  return JSON.stringify(prev.markers) === JSON.stringify(next.markers);
});

// === MEMOIZED POLYLINE ===
const MapPolyline = memo(({ positions }: { positions: [number, number][] }) => {
  return <Polyline positions={positions} pathOptions={{ color: "#22c55e", weight: 6, opacity: 0.9 }} />
}, (prev, next) => {
  // Only re-render if route points change length or endpoints
  if (prev.positions.length !== next.positions.length) return false;
  // Check first and last point usually enough for stability
  return prev.positions[0] === next.positions[0] && prev.positions[prev.positions.length - 1] === next.positions[next.positions.length - 1];
});

// === MAP CONTROLLER ===
function MapController({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  const map = useMap();
  const [isLocked, setIsLocked] = useState(true);
  const isLockedRef = useRef(true);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    const container = map.getContainer();
    const startInteraction = () => {
      isInteractingRef.current = true;
      if (isLockedRef.current) {
        isLockedRef.current = false;
        setIsLocked(false);
      }
    };
    const endInteraction = () => { isInteractingRef.current = false; };

    container.addEventListener('mousedown', startInteraction);
    container.addEventListener('touchstart', startInteraction);
    window.addEventListener('mouseup', endInteraction);
    window.addEventListener('touchend', endInteraction);

    return () => {
      container.removeEventListener('mousedown', startInteraction);
      container.removeEventListener('touchstart', startInteraction);
      window.removeEventListener('mouseup', endInteraction);
      window.removeEventListener('touchend', endInteraction);
    };
  }, [map]);

  useMapEvents({
    dragstart: () => { isInteractingRef.current = true; isLockedRef.current = false; setIsLocked(false); },
    zoomstart: () => { isInteractingRef.current = true; isLockedRef.current = false; setIsLocked(false); },
    dragend: () => { isInteractingRef.current = false; },
    zoomend: () => { isInteractingRef.current = false; }
  });

  useEffect(() => {
    if (isLockedRef.current && !isInteractingRef.current && center) {
      map.flyTo(center, 16, { animate: true, duration: 1.5 });
    }
  }, [center, map]);

  const handleRecenter = useCallback(() => {
    isLockedRef.current = true;
    setIsLocked(true);
    isInteractingRef.current = false;
    map.flyTo(center, 16, { animate: true, duration: 1 });
  }, [center, map]);

  useEffect(() => {
    if (recenterKey) handleRecenter();
  }, [recenterKey, handleRecenter]);

  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: "350px", marginRight: "16px", pointerEvents: "auto", zIndex: 4000 }}>
      <button
        onClick={(e) => { e.stopPropagation(); handleRecenter(); }}
        className={cn("w-12 h-12 rounded-xl border border-[#84cc16] shadow-xl flex items-center justify-center transition-all duration-300 active:scale-95", isLocked ? "bg-[#84cc16] text-black" : "bg-[#1A1A1A] text-[#84cc16]")}
      >
        <Navigation className={cn("w-5 h-5 transition-transform duration-300", isLocked ? "fill-current rotate-45" : "fill-transparent")} />
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
      if (route[0][0] !== 0 && route[1][0] !== 0) { // Check valid coords
        getRoadRoute(route[0], route[1]).then(path => {
          if (path) setEnhancedRoute(path);
        });
      }
    } else {
      setEnhancedRoute(null);
    }
  }, [route?.[0]?.[0], route?.[1]?.[0]]);

  // Memoize markers to prevent prop drilling re-renders
  const memoMarkers = useMemo(() => markers, [JSON.stringify(markers)]);
  // FIX: Allow route of length 2 (Straight line) as fallback if enhancedRoute fails
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

        {onMapClick && <div style={{ display: 'none' }}>{/* Use hook for click */}</div>}

        <MapMarkers markers={memoMarkers} />
        {memoRoute && <MapPolyline positions={memoRoute} />}

      </MapContainer>
    </div>
  );
};

// ... existing code ...

// Update MapController Style
function MapControllerWrapper({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  // ...
}
// Actually, I'll just edit the MapController return directly below since I am in replacing block.
// Wait, I can't reach MapController from here easily in one block if it's far up.
// I will target the MapController return specifically in a separate step if needed, or if it is close.
// Looking at file content, MapController is above Main Component. 
// I will do the route fix here, then the button fix in next step to be safe, OR I can try to find where MapController return is.
// It seems `MapController` is lines 93-157.


export default Map;
