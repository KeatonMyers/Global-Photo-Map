import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { usePhotos } from "@/hooks/use-photos";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `
      <div class="photo-marker-container">
        <div class="photo-cluster">
          <span>${count.toLocaleString()}</span>
        </div>
        <div class="photo-marker-tail"></div>
      </div>
    `,
    className: "custom-cluster-icon",
    iconSize: [68, 80],
    iconAnchor: [34, 80],
  });
};

interface PhotoMapProps {
  flyToCoords?: [number, number] | null;
}

export function PhotoMap({ flyToCoords }: PhotoMapProps) {
  const [, setBounds] = useState<string>("");
  const { data: photos } = usePhotos();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResponse | null>(null);

  return (
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
          spiderfyOnMaxZoom={true}
        >
          {photos?.map((photo) => (
            <Marker
              key={photo.id}
              position={[photo.latitude, photo.longitude]}
              icon={createCustomIcon(photo.imageUrl)}
              eventHandlers={{ click: () => setSelectedPhoto(photo) }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Photo Preview Drawer */}
      <Drawer open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DrawerContent className="bg-black border-white/10 text-foreground p-0 overflow-hidden max-h-[92dvh]">
          <VisuallyHidden><DrawerTitle>Photo Preview</DrawerTitle></VisuallyHidden>
          {selectedPhoto && (
            <div className="relative w-full flex flex-col">
              {/* Full-bleed photo */}
              <div className="relative w-full bg-black" style={{ minHeight: "55dvh" }}>
                <img
                  src={selectedPhoto.imageUrl}
                  alt="Photo"
                  data-testid="photo-preview-image"
                  className="w-full object-cover"
                  style={{ maxHeight: "72dvh", minHeight: "55dvh", objectFit: "cover" }}
                />

                {/* Top gradient — space for drag handle + collection badge */}
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

                {/* Collection badge top-right */}
                {selectedPhoto.collection && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-semibold text-white border border-white/20">
                    {selectedPhoto.collection.name}
                  </div>
                )}

                {/* Bottom gradient overlay with user info */}
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

                <div className="absolute inset-x-0 bottom-0 p-5 pb-4">
                  {/* Name + avatar row */}
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="w-11 h-11 border-2 border-white/30 shrink-0">
                      <AvatarImage src={selectedPhoto.user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/30 text-white font-bold text-base">
                        {selectedPhoto.user?.firstName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-lg leading-tight truncate">
                        {selectedPhoto.user?.firstName
                          ? `${selectedPhoto.user.firstName}${selectedPhoto.user.lastName ? " " + selectedPhoto.user.lastName : ""}`
                          : "Unknown"}
                      </div>
                      {selectedPhoto.takenAt && (
                        <div className="flex items-center gap-1 text-white/70 text-sm mt-0.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{format(new Date(selectedPhoto.takenAt), "MMMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location + directions row */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 text-white/50 text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{selectedPhoto.latitude.toFixed(4)}, {selectedPhoto.longitude.toFixed(4)}</span>
                    </div>
                    <a
                      href={`https://maps.apple.com/?ll=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-directions"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-white border border-white/20 hover:bg-white/25 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Directions
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
