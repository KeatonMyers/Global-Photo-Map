import { useEffect, useState, useMemo } from "react";
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
        <div class="photo-marker">
          <div class="photo-marker-img" style="background-image: url('${imageUrl}')"></div>
        </div>
      </div>
    `,
    className: "custom-leaflet-icon",
    iconSize: [64, 72],
    iconAnchor: [32, 72],
    popupAnchor: [0, -72],
  });
};

const createClusterIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div class="photo-cluster"><span>${count}</span></div>`,
    className: "custom-cluster-icon",
    iconSize: [40, 40],
  });
};

export function PhotoMap() {
  const [bounds, setBounds] = useState<string>("");
  const { data: photos, isLoading } = usePhotos();
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoResponse | null>(null);

  // Default to center of US if no photos, else center on first photo
  const defaultCenter: [number, number] = useMemo(() => {
    if (photos && photos.length > 0) {
      return [photos[0].latitude, photos[0].longitude];
    }
    return [39.8283, -98.5795];
  }, [photos]);

  return (
    <div className="absolute inset-0 z-0 bg-black">
      <MapContainer 
        center={defaultCenter} 
        zoom={4} 
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* We place zoom control at bottom right, above nav */}
        <div className="leaflet-bottom leaflet-right mb-24 mr-4 z-[400]">
          <div className="leaflet-control leaflet-bar leaflet-control-zoom">
            <a className="leaflet-control-zoom-in" href="#" title="Zoom in" role="button" aria-label="Zoom in">+</a>
            <a className="leaflet-control-zoom-out" href="#" title="Zoom out" role="button" aria-label="Zoom out">−</a>
          </div>
        </div>

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
