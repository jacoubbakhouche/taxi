import { useEffect } from "react";
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
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  route?: [number, number][];
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

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
        if (marker.icon === "🚗" || marker.icon === "car") {
          iconHtml = renderToStaticMarkup(
            <div className="relative flex items-center justify-center w-10 h-10 bg-[#F5D848] rounded-full shadow-[0_0_15px_rgba(245,216,72,0.5)] border-2 border-white transform transition-transform hover:scale-110">
              <Car className="w-5 h-5 text-black fill-black" />
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
              <MapPin className="w-10 h-10 text-[#F5D848] fill-black drop-shadow-lg" />
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

const Map = ({ center, zoom = 13, markers = [], onMapClick, route }: MapProps) => {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg" style={{ perspective: "1000px" }}>
      <div style={{ transform: "rotateX(20deg) scale(1.1)", height: "100%", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater center={center} />
          {onMapClick && <MapClickHandler onClick={onMapClick} />}
          <MapMarkers markers={markers} />
          {route && route.length > 0 && (
            <Polyline
              positions={route}
              color="#22c55e"
              weight={5}
              opacity={0.8}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default Map;
