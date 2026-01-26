import { useEffect, useState, useRef, useCallback } from "react";
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

// === CORE CONTROLLER ===
// Uses Refs for synchronous, immediate blocking of updates to prevent "fighting".
function MapController({ center, recenterKey }: { center: [number, number], recenterKey?: number }) {
  const map = useMap();

  // STATE: Controls the visual UI of the button (Green/White)
  const [isLocked, setIsLocked] = useState(true);

  // REF: Synchronous lock for logic (prevents race conditions)
  const isLockedRef = useRef(true);
  const isInteractingRef = useRef(false);

  // --- 1. IMMEDIATE INTERACTION BLOCKING ---
  // We use standard DOM listeners on the map container for 'mousedown'/'touchstart' 
  // to block updates BEFORE Leaflet even fires 'dragstart'.
  useEffect(() => {
    const container = map.getContainer();

    const startInteraction = () => {
      isInteractingRef.current = true;
      // If user touches map, we unlock PERMANENTLY until they click Re-Center
      if (isLockedRef.current) {
        isLockedRef.current = false;
        setIsLocked(false);
      }
    };

    const endInteraction = () => {
      isInteractingRef.current = false;
    };

    // Capture all touch/mouse starts
    container.addEventListener('mousedown', startInteraction);
    container.addEventListener('touchstart', startInteraction);

    // We listen for end of Drag via Leaflet events below, but also global mouseup for safety
    window.addEventListener('mouseup', endInteraction);
    window.addEventListener('touchend', endInteraction);

    return () => {
      container.removeEventListener('mousedown', startInteraction);
      container.removeEventListener('touchstart', startInteraction);
      window.removeEventListener('mouseup', endInteraction);
      window.removeEventListener('touchend', endInteraction);
    };
  }, [map]);

  // --- 2. LEAFLET EVENT LISTENERS ---
  useMapEvents({
    dragstart: () => {
      isInteractingRef.current = true;
      isLockedRef.current = false;
      setIsLocked(false);
    },
    zoomstart: () => {
      isInteractingRef.current = true;
      isLockedRef.current = false;
      setIsLocked(false);
    },
    dragend: () => { isInteractingRef.current = false; },
    zoomend: () => { isInteractingRef.current = false; }
  });

  // --- 3. SMART UPDATE LOOP ---
  useEffect(() => {
    // Only fly if Locked AND Not Interacting
    if (isLockedRef.current && !isInteractingRef.current && center) {
      // Check distance to avoid micro-stutters? Leaflet flyTo handles small moves gracefully-ish.
      // We force animation to keep it smooth.
      map.flyTo(center, 16, { animate: true, duration: 1.5 });
    }
  }, [center, map]); // Triggers whenever 'center' prop updates (GPS ping)

  // --- 4. RE-CENTER ACTION ---
  const handleRecenter = useCallback(() => {
    isLockedRef.current = true;
    setIsLocked(true);
    isInteractingRef.current = false;
    map.flyTo(center, 16, { animate: true, duration: 1 });
  }, [center, map]);

  // Listen for forced recenter prop
  useEffect(() => {
    if (recenterKey) handleRecenter();
  }, [recenterKey, handleRecenter]);


  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: "120px", marginRight: "16px", pointerEvents: "auto", zIndex: 1000 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRecenter();
        }}
        className={cn(
          "w-14 h-14 rounded-full border-2 shadow-xl flex items-center justify-center transition-all duration-300 group active:scale-95",
          isLocked
            ? "bg-[#84cc16] border-[#84cc16] text-black" // LOCKED
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50" // UNLOCKED
        )}
      >
        <Navigation className={cn(
          "w-6 h-6 transition-transform duration-300",
          isLocked ? "fill-current rotate-45" : "fill-transparent"
        )} />
      </button>
    </div>
  );
}

// --- HELPERS ---
function RouteBoundsFitter({ route }: { route?: [number, number][] }) {
  const map = useMap();
  const hasFitted = useRef(false);
  const prevRouteKey = useRef("");

  useEffect(() => {
    if (route && route.length > 1) {
      // Create a simple key to detect route changes
      const key = `${route[0][0]},${route[0][1]}-${route[route.length - 1][0]},${route[route.length - 1][1]}`;

      if (key !== prevRouteKey.current) {
        const bounds = L.latLngBounds(route);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          hasFitted.current = true;
          prevRouteKey.current = key;
        }
      }
    }
  }, [route, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

function MapMarkers({ markers }: { markers: MapProps['markers'] }) {
  if (!markers?.length) return null;
  return (
    <>
      {markers.map((marker, i) => {
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
          // Default User or Custom
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-lg border-2 border-gray-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse absolute -top-1 -right-1" />
              <User className="w-4 h-4 text-black" />
            </div>
          );
        }

        return <Marker key={i} position={marker.position} icon={L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [40, 40], iconAnchor: anchor })} >
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      })}
    </>
  )
}

// --- FETCH ROUTE ---
async function getRoadRoute(start: [number, number], end: [number, number]) {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number, number][];
    }
  } catch (e) { console.error(e); }
  return null;
}

const Map = ({ center, zoom = 13, markers = [], onMapClick, route, recenterKey }: MapProps) => {
  const [enhancedRoute, setEnhancedRoute] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (route?.length === 2) {
      getRoadRoute(route[0], route[1]).then(setEnhancedRoute);
    } else {
      setEnhancedRoute(null);
    }
  }, [route?.[0]?.[0], route?.[1]?.[0]]); // Simple deep check

  const displayRoute = enhancedRoute || (route?.length && route.length > 2 ? route : null);

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
        <RouteBoundsFitter route={displayRoute || undefined} />

        {onMapClick && <MapClickHandler onClick={onMapClick} />}
        <MapMarkers markers={markers} />

        {displayRoute && (
          <Polyline positions={displayRoute} pathOptions={{ color: "#22c55e", weight: 6, opacity: 0.9 }} />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;
