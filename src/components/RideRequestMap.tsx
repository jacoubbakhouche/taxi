import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Car, MapPin, Navigation } from "lucide-react";

// Fix for Leaflet default icons in React
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

interface RideRequestMapProps {
    driverLocation: [number, number] | null;
    pickupLocation: [number, number] | null;
    dropoffLocation: [number, number] | null;
}

// Helper to fetch route from OSRM
async function getRoadRoute(start: [number, number], end: [number, number]) {
    const startStr = `${start[1]},${start[0]}`;
    const endStr = `${end[1]},${end[0]}`;

    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${startStr};${endStr}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;
        return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
    } catch (error) {
        console.error("Error fetching route:", error);
        return null;
    }
}

// Component to handle auto-fitting bounds
function BoundsFitter({
    driverLocation,
    pickupLocation,
    dropoffLocation
}: RideRequestMapProps) {
    const map = useMap();

    useEffect(() => {
        if (!pickupLocation || !dropoffLocation) return;

        const points: [number, number][] = [pickupLocation, dropoffLocation];
        if (driverLocation) points.push(driverLocation);

        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 16,
                animate: true,
                duration: 1
            });
        }
    }, [driverLocation, pickupLocation, dropoffLocation, map]);

    return null;
}

const RideRequestMap = ({ driverLocation, pickupLocation, dropoffLocation }: RideRequestMapProps) => {
    const [pathToPickup, setPathToPickup] = useState<[number, number][] | null>(null);
    const [pathToDropoff, setPathToDropoff] = useState<[number, number][] | null>(null);

    // 1. Fetch Path A (Driver -> Pickup)
    useEffect(() => {
        if (driverLocation && pickupLocation) {
            getRoadRoute(driverLocation, pickupLocation).then(setPathToPickup);
        }
    }, [driverLocation, pickupLocation]);

    // 2. Fetch Path B (Pickup -> Dropoff)
    useEffect(() => {
        if (pickupLocation && dropoffLocation) {
            getRoadRoute(pickupLocation, dropoffLocation).then(setPathToDropoff);
        }
    }, [pickupLocation, dropoffLocation]);

    // Icons
    const carIcon = useMemo(() => L.divIcon({
        html: renderToStaticMarkup(
            <div className="relative flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-xl border-2 border-blue-500">
                <Car className="w-6 h-6 text-black fill-current" />
            </div>
        ),
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    }), []);

    const pickupIcon = useMemo(() => L.divIcon({
        html: renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <MapPin className="w-10 h-10 text-green-500 fill-green-500/20 drop-shadow-lg" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full" />
            </div>
        ),
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 38],
    }), []);

    const dropoffIcon = useMemo(() => L.divIcon({
        html: renderToStaticMarkup(
            <div className="relative flex items-center justify-center">
                <MapPin className="w-10 h-10 text-red-500 fill-red-500/20 drop-shadow-lg" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full" />
            </div>
        ),
        className: 'bg-transparent',
        iconSize: [40, 40],
        iconAnchor: [20, 38],
    }), []);

    // Use Algier as default center if locations missing to prevent crash
    const center = driverLocation || pickupLocation || [36.75, 3.05];

    return (
        <div className="w-full h-full rounded-lg overflow-hidden shadow-lg relative bg-[#242424]">
            <MapContainer
                center={center}
                zoom={13}
                style={{ height: "100%", width: "100%", background: '#242424' }}
                zoomControl={false} // Cleaner look
            >
                <TileLayer
                    attribution='&copy; Google Maps'
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    className="dark-map-tiles"
                />

                {/* REMOVED AGGRESSIVE BOUNDS FITTER to prevent fighting with auto-follow */}
                {/* We rely on MapRecenterControl for active tracking now */}

                <MapRecenterControl
                    driverLocation={driverLocation}
                    pickupLocation={pickupLocation} // Pass pickup to allow initial bounds fit
                />

                {/* Path A: Driver -> Pickup (Green Dashed) */}
                {pathToPickup && (
                    <Polyline
                        positions={pathToPickup}
                        pathOptions={{
                            color: '#22c55e', // Green-500
                            weight: 5,
                            dashArray: '10, 10',
                            opacity: 0.9,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }}
                    />
                )}

                {/* Path B: Pickup -> Dropoff (Blue Solid) */}
                {pathToDropoff && (
                    <Polyline
                        positions={pathToDropoff}
                        pathOptions={{
                            color: '#3b82f6', // Blue-500
                            weight: 6,
                            opacity: 1,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }}
                    />
                )}

                {/* Markers */}
                {driverLocation && (
                    <Marker position={driverLocation} icon={carIcon} zIndexOffset={100}>
                        {/* No Popup for driver to keep view clean, or make it optional */}
                    </Marker>
                )}

                {pickupLocation && (
                    <Marker position={pickupLocation} icon={pickupIcon}>
                        {/* Pickup */}
                    </Marker>
                )}

                {dropoffLocation && (
                    <Marker position={dropoffLocation} icon={dropoffIcon}>
                        {/* Destination */}
                    </Marker>
                )}

            </MapContainer>
        </div>
    );
};

// Component: Handles Camera Logic (Follow, Drag, Fit)
function MapRecenterControl({ driverLocation, pickupLocation }: { driverLocation: [number, number] | null, pickupLocation: [number, number] | null }) {
    const map = useMap();
    const [mode, setMode] = useState<'following' | 'manual' | 'fitting'>('fitting');
    const [hasInitialFit, setHasInitialFit] = useState(false);

    // 1. Initial Bounds Fit (Once)
    useEffect(() => {
        if (!hasInitialFit && driverLocation && pickupLocation) {
            const bounds = L.latLngBounds([driverLocation, pickupLocation]);
            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.2), { animate: false }); // Instant fit first time
                setHasInitialFit(true);
                // After a brief delay to let the user see the route, switch to following the driver
                setTimeout(() => setMode('following'), 2000);
            }
        } else if (!hasInitialFit && driverLocation) {
            // Fallback if no pickup yet
            map.setView(driverLocation, 15);
            setHasInitialFit(true);
            setMode('following');
        }
    }, [driverLocation, pickupLocation, hasInitialFit, map]);

    // 2. Auto-follow Logic (Smooth Pan)
    useEffect(() => {
        if (mode === 'following' && driverLocation) {
            map.flyTo(driverLocation, 17, {
                animate: true,
                duration: 1.5, // Smooth float
                easeLinearity: 0.25
            });
        }
    }, [driverLocation, mode, map]);

    // 3. Detect Manual Drag to break follow mode
    useEffect(() => {
        const onDragStart = () => {
            if (mode === 'following') setMode('manual');
        };
        map.on('dragstart', onDragStart);
        return () => { map.off('dragstart', onDragStart); };
    }, [map, mode]);

    const handleRecenter = (e: any) => {
        e.stopPropagation();
        if (driverLocation) {
            setMode('following');
            map.flyTo(driverLocation, 17, { animate: true, duration: 1 });
        }
    };

    return (
        <div className="leaflet-bottom leaflet-right" style={{ bottom: '8rem', right: '1rem', pointerEvents: 'auto', zIndex: 1000 }}>
            <button
                onClick={handleRecenter}
                className={`bg-white p-3 rounded-full shadow-xl border border-gray-200 transition-all active:scale-95 ${mode === 'following' ? 'text-[#84cc16] ring-2 ring-[#84cc16]/20' : 'text-gray-500 hover:text-black'}`}
                title="ركز علي (Recenter)"
            >
                <Navigation className={`w-6 h-6 ${mode === 'following' ? 'fill-current' : ''}`} />
            </button>
        </div>
    );
}

export default RideRequestMap;
