import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { usePhotos } from "@/hooks/use-photos";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Navigation } from "lucide-react";
import { format } from "date-fns";
import type { PhotoResponse } from "@shared/schema";

// Custom component to handle map bounds and interactions
function MapEvents({ onBoundsChange }: { onBoundsChange: (bounds: string) => void }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      const boundsString = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
      onBoundsChange(boundsString);
    };

    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [map, onBoundsChange]);

  return null;
}

// Function to generate the custom Apple Photos style marker
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

export function PhotoMap() {
  const [bounds, setBounds] = useState<string>("");
  const { data: photos, isLoading } = usePhotos();
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
        {/* Ocean base layer - dark navy blue */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com">Esri</a>'
          zIndex={1}
        />
        {/* Land + country borders overlay with dark styling */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          zIndex={2}
          opacity={0.85}
        />
        {/* Labels only layer on top */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          attribution=''
          zIndex={3}
        />

        <MapEvents onBoundsChange={setBounds} />

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
              eventHandlers={{
                click: () => setSelectedPhoto(photo),
              }}
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
                      {selectedPhoto.user?.firstName?.[0] || selectedPhoto.user?.username?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {selectedPhoto.user?.firstName} {selectedPhoto.user?.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {selectedPhoto.takenAt ? format(new Date(selectedPhoto.takenAt), 'PPP') : 'Unknown Date'}
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
                    alt="Map Pin" 
                    className="w-full max-h-[60vh] object-contain"
                  />
                  <div className="absolute bottom-4 right-4">
                    <a 
                      href={`https://maps.apple.com/?ll=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm font-medium text-white hover:bg-white/20 transition-colors shadow-lg"
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
