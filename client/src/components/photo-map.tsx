import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { usePhotos } from "@/hooks/use-photos";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
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
        <DrawerContent className="bg-card/95 backdrop-blur-3xl border-white/10 text-foreground">
          {selectedPhoto && (
            <div className="max-w-3xl mx-auto w-full pb-safe">
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-white/10">
                    <AvatarImage src={selectedPhoto.user?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {selectedPhoto.user?.firstName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {selectedPhoto.user?.firstName} {selectedPhoto.user?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {selectedPhoto.takenAt ? format(new Date(selectedPhoto.takenAt), "PPP") : "Unknown Date"}
                    </div>
                  </div>
                </div>
                {selectedPhoto.collection && (
                  <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-white/90 border border-white/5">
                    {selectedPhoto.collection.name}
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black/50">
                  <img
                    src={selectedPhoto.imageUrl}
                    alt="Photo"
                    className="w-full max-h-[60vh] object-contain"
                  />
                  <div className="absolute bottom-4 right-4">
                    <a
                      href={`https://maps.apple.com/?ll=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md text-sm font-medium text-white border border-white/20"
                    >
                      <Navigation className="w-4 h-4" />
                      Directions
                    </a>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {selectedPhoto.latitude.toFixed(4)}, {selectedPhoto.longitude.toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
