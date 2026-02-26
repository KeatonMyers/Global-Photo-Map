import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { usePhotos } from "@/hooks/use-photos";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Navigation } from "lucide-react";
import { format } from "date-fns";
import type { PhotoResponse } from "@shared/schema";

function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: string) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBoundsChange(`${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`);
    };
    map.on("moveend", handleMoveEnd);
    return () => { map.off("moveend", handleMoveEnd); };
  }, [map, onBoundsChange]);
  return null;
}

function FlyToLocation({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  const prevCoords = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!coords) return;
    if (prevCoords.current?.[0] === coords[0] && prevCoords.current?.[1] === coords[1]) return;
    prevCoords.current = coords;
    map.flyTo(coords, 8, { duration: 1.5 });
  }, [coords, map]);
  return null;
}

const createCustomIcon = (imageUrl: string) => {
  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-marker-frame">
          <div class="photo-marker-img" style="background-image: url('${imageUrl}')"></div>
        </div>
        <div class="photo-marker-tail"></div>
      </div>
    `,
    className: "custom-leaflet-icon",
    iconSize: [68, 80],
    iconAnchor: [34, 80],
    popupAnchor: [0, -80],
  });
};

const createClusterIcon = (cluster: any) => {
  const children = cluster.getAllChildMarkers();
  const firstHtml: string = children[0]?.options?.icon?.options?.html ?? "";
  const match = firstHtml.match(/background-image:\s*url\((['"]?)([\s\S]*?)\1\)/);
  const imageUrl = match?.[2] ?? "";

  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-marker-frame">
          <div class="photo-marker-img" style="background-image: url('${imageUrl}')"></div>
        </div>
        <div class="photo-marker-tail"></div>
      </div>
    `,
    className: "custom-cluster-icon",
    iconSize: [68, 80],
    iconAnchor: [34, 80],
  });
};

const DISMISS_THRESHOLD = 80;

interface FullScreenPhotoProps {
  photo: PhotoResponse;
  onClose: () => void;
}

function FullScreenPhoto({ photo, onClose }: FullScreenPhotoProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState(false);

  const dismiss = (toX = 0, toY = 120) => {
    setExiting(true);
    setOffset({ x: toX, y: toY });
    setTimeout(onClose, 280);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    const x = Math.max(0, dx);
    const y = Math.max(0, dy);
    setOffset({ x, y });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offset.y >= DISMISS_THRESHOLD) {
      dismiss(offset.x, window.innerHeight);
    } else if (offset.x >= DISMISS_THRESHOLD) {
      dismiss(window.innerWidth, offset.y);
    } else {
      setOffset({ x: 0, y: 0 });
    }
    touchStartRef.current = null;
  };

  const progress = Math.min(1, Math.max(offset.x, offset.y) / 200);
  const opacity = exiting ? 0 : 1 - progress * 0.4;
  const scale = 1 - progress * 0.04;

  return (
    <div
      className="fixed inset-0 z-50 bg-black touch-none"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        opacity,
        transition: isDragging || exiting
          ? exiting ? "transform 0.28s ease-out, opacity 0.28s ease-out" : "none"
          : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
        borderRadius: progress > 0.05 ? `${progress * 24}px` : "0px",
        willChange: "transform, opacity",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Full-screen photo */}
      <img
        src={photo.imageUrl}
        alt="Photo"
        data-testid="photo-preview-image"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Top gradient + close button + collection badge */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Swipe hint bar at top */}
      <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
        <div className="w-10 h-1 rounded-full bg-white/40" />
      </div>

      {/* Close button */}
      <button
        data-testid="button-close-photo"
        onClick={() => dismiss()}
        className="absolute top-10 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:bg-white/20 transition-colors"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="text-white text-lg leading-none font-light">✕</span>
      </button>

      {photo.collection && (
        <div className="absolute top-10 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-semibold text-white border border-white/20">
          {photo.collection.name}
        </div>
      )}

      {/* Bottom gradient + metadata */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 p-5 pb-safe" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        {/* Avatar + name + date */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-11 h-11 border-2 border-white/30 shrink-0">
            <AvatarImage src={photo.user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/30 text-white font-bold text-base">
              {photo.user?.firstName?.[0] || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-bold text-white text-lg leading-tight truncate">
              {photo.user?.firstName
                ? `${photo.user.firstName}${photo.user.lastName ? " " + photo.user.lastName : ""}`
                : "Unknown"}
            </div>
            {photo.takenAt && (
              <div className="flex items-center gap-1 text-white/70 text-sm mt-0.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{format(new Date(photo.takenAt), "MMMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Location + directions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{photo.locationName || `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`}</span>
          </div>
          <a
            href={`https://maps.apple.com/?ll=${photo.latitude},${photo.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-directions"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-white border border-white/20 active:bg-white/25 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Navigation className="w-3.5 h-3.5" />
            Directions
          </a>
        </div>
      </div>
    </div>
  );
}

interface PhotoMapProps {
  flyToCoords?: [number, number] | null;
}

export function PhotoMap({ flyToCoords }: PhotoMapProps) {
  const [, setBounds] = useState<string>("");
  const { data: photos } = usePhotos();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResponse | null>(null);

  return (
    <>
      <div className="absolute inset-0 z-0 bg-[#081627]">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={18}
          className="w-full h-full"
          zoomControl={false}
          worldCopyJump={false}
          maxBounds={[[-90, -Infinity], [90, Infinity]]}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com">Esri</a>'
            zIndex={1}
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            zIndex={2}
            opacity={0.85}
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            attribution=""
            zIndex={3}
          />

          <MapEvents onBoundsChange={setBounds} />
          <FlyToLocation coords={flyToCoords ?? null} />

          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterIcon}
            maxClusterRadius={50}
            spiderfyOnMaxZoom={false}
            showCoverageOnHover={false}
            animate={false}
            polygonOptions={{ interactive: false, opacity: 0, fillOpacity: 0 }}
          >
            {photos?.map((photo) => (
              <Marker
                key={photo.id}
                position={[photo.latitude, photo.longitude]}
                icon={createCustomIcon(photo.imageUrl)}
                eventHandlers={{
                  click: () => setSelectedPhoto(photo),
                  touchend: (e: any) => {
                    e.originalEvent?.stopPropagation?.();
                    setSelectedPhoto(photo);
                  },
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {selectedPhoto && (
        <FullScreenPhoto
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </>
  );
}
