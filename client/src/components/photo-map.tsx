import { useEffect, useState, useRef, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { PhotoResponse } from "@shared/schema";

type MapMarker = {
  id: number;
  userId: string;
  thumbnailUrl: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  country: string | null;
  takenAt: Date | null;
};

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

const COUNTRY_NAME_MAP: Record<string, string> = {
  "United States": "United States of America",
  "USA": "United States of America",
  "US": "United States of America",
  "UK": "United Kingdom",
  "England": "United Kingdom",
  "Scotland": "United Kingdom",
  "Wales": "United Kingdom",
  "Northern Ireland": "United Kingdom",
  "Russia": "Russia",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
  "Czech Republic": "Czech Republic",
  "Czechia": "Czech Republic",
  "DR Congo": "Democratic Republic of the Congo",
  "Republic of the Congo": "Republic of the Congo",
  "Tanzania": "United Republic of Tanzania",
  "Ivory Coast": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "The Netherlands": "Netherlands",
  "Nederland": "Netherlands",
};

function normalizeCountryName(name: string): string {
  const trimmed = name.trim();
  return COUNTRY_NAME_MAP[trimmed] || trimmed;
}

function HighlightedCountries({ visitedCountries }: { visitedCountries: Set<string> }) {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch("/countries.geo.json")
      .then((res) => res.json())
      .then(setGeoData)
      .catch(() => {});
  }, []);

  const highlightStyle = useMemo(
    () => ({
      color: "rgba(255, 255, 255, 0.5)",
      weight: 1.5,
      fillColor: "rgba(200, 210, 220, 0.15)",
      fillOpacity: 1,
    }),
    []
  );

  const defaultStyle = useMemo(
    () => ({
      color: "transparent",
      weight: 0,
      fillColor: "transparent",
      fillOpacity: 0,
    }),
    []
  );

  const onEachFeature = useMemo(() => {
    return (feature: any, layer: any) => {
      const name = feature?.properties?.name;
      if (name && visitedCountries.has(normalizeCountryName(name))) {
        layer.setStyle(highlightStyle);
      } else {
        layer.setStyle(defaultStyle);
      }
    };
  }, [visitedCountries, highlightStyle, defaultStyle]);

  if (!geoData || visitedCountries.size === 0) return null;

  return (
    <GeoJSON
      key={Array.from(visitedCountries).sort().join(",")}
      data={geoData}
      onEachFeature={onEachFeature}
      style={defaultStyle}
      interactive={false}
    />
  );
}

const createCustomIcon = (thumbnailUrl: string | null) => {
  const imgStyle = thumbnailUrl
    ? `background-image: url('${thumbnailUrl}')`
    : `background: linear-gradient(135deg, #3b82f6, #8b5cf6)`;
  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-marker-frame">
          <div class="photo-marker-img" style="${imgStyle}"></div>
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
  const matchBg = firstHtml.match(/background-image:\s*url\((['"]?)([\s\S]*?)\1\)/);
  const imgStyle = matchBg
    ? `background-image: url('${matchBg[2]}')`
    : `background: linear-gradient(135deg, #3b82f6, #8b5cf6)`;

  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-marker-frame">
          <div class="photo-marker-img" style="${imgStyle}"></div>
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
      {/* Full-screen photo — original aspect ratio, no crop */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={photo.imageUrl}
          alt="Photo"
          data-testid="photo-preview-image"
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Close button + collection badge (no overlay) */}

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

      {/* Bottom metadata — transparent, text shadow for readability */}
      <div className="absolute inset-x-0 bottom-0 p-5" style={{ paddingBottom: "max(32px, calc(env(safe-area-inset-bottom) + 12px))", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
        {/* Avatar + name + date */}
        <div className="flex items-center gap-3 mb-2">
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

        {/* Location */}
        <div className="flex items-center gap-1.5 text-white/50 text-xs">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{photo.locationName || `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`}</span>
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
  const { user } = useAuth();
  const { data: markers } = useQuery<MapMarker[]>({
    queryKey: ["/api/friends/map-markers"],
    queryFn: async () => {
      const res = await fetch("/api/friends/map-markers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch map markers");
      return res.json();
    },
    enabled: !!user,
  });
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResponse | null>(null);
  const [loadingPhotoId, setLoadingPhotoId] = useState<number | null>(null);

  const handleMarkerClick = async (markerId: number) => {
    setLoadingPhotoId(markerId);
    try {
      const res = await fetch(`/api/photos/${markerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch photo");
      const photo = await res.json();
      setSelectedPhoto(photo);
    } catch (err) {
      console.error("Failed to load photo:", err);
    } finally {
      setLoadingPhotoId(null);
    }
  };

  const visitedCountries = useMemo(() => {
    const set = new Set<string>();
    if (markers) {
      for (const m of markers) {
        if (m.country) set.add(normalizeCountryName(m.country));
      }
    }
    return set;
  }, [markers]);

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
          worldCopyJump={true}
          maxBoundsViscosity={1.0}
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

          <HighlightedCountries visitedCountries={visitedCountries} />

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
            {markers?.map((marker) => (
              <Marker
                key={marker.id}
                position={[marker.latitude, marker.longitude]}
                icon={createCustomIcon(marker.thumbnailUrl)}
                eventHandlers={{
                  click: () => handleMarkerClick(marker.id),
                  touchend: (e: any) => {
                    e.originalEvent?.stopPropagation?.();
                    handleMarkerClick(marker.id);
                  },
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {loadingPhotoId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="photo-loading-overlay">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {selectedPhoto && (
        <FullScreenPhoto
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </>
  );
}
