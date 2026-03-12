import { useState, useRef, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MapPin, Check, Loader2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDeletePhoto } from "@/hooks/use-photos";
import { ProfilePhotoViewer } from "@/components/profile-photo-viewer";
import { api } from "@shared/routes";
import type { Photo } from "@shared/schema";
import { DateStamp } from "@/components/date-stamp";

type PhotoItem = Photo & { user?: any; collection?: any };

interface SortablePhotoProps {
  photo: PhotoItem;
  isEditMode: boolean;
  isDragging: boolean;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  onDelete: (id: number) => void;
  onDoubleTap: () => void;
}

function SortablePhoto({ photo, isEditMode, isDragging, onLongPressStart, onLongPressEnd, onDelete, onDoubleTap }: SortablePhotoProps) {
  const lastTapRef = useRef(0);
  const touchMovedRef = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: photo.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const touchStartTime = useRef(0);
  const TAP_DURATION = 400;

  const handleTouchStartLocal = useCallback((e: React.TouchEvent) => {
    touchMovedRef.current = false;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchStartTime.current = Date.now();
    onLongPressStart();
  }, [onLongPressStart]);

  const handleTouchMoveLocal = useCallback((e: React.TouchEvent) => {
    if (touchStartPos.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        touchMovedRef.current = true;
      }
    }
    onLongPressEnd();
  }, [onLongPressEnd]);

  const handleTouchEndLocal = useCallback(() => {
    onLongPressEnd();
    touchStartPos.current = null;
    if (isEditMode || touchMovedRef.current) return;
    const elapsed = Date.now() - touchStartTime.current;
    if (elapsed < TAP_DURATION) {
      onDoubleTap();
    }
  }, [isEditMode, onDoubleTap, onLongPressEnd]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isEditMode ? listeners : {})}
      onTouchStart={!isEditMode ? handleTouchStartLocal : undefined}
      onTouchEnd={!isEditMode ? handleTouchEndLocal : undefined}
      onTouchMove={!isEditMode ? handleTouchMoveLocal : undefined}
      onTouchCancel={!isEditMode ? onLongPressEnd : undefined}
      onMouseDown={!isEditMode ? onLongPressStart : undefined}
      onMouseUp={!isEditMode ? onLongPressEnd : undefined}
      onMouseLeave={!isEditMode ? onLongPressEnd : undefined}
      onDoubleClick={!isEditMode ? onDoubleTap : undefined}
      className={`aspect-square relative group overflow-hidden bg-white/5 ${
        isEditMode ? "touch-none cursor-grab active:cursor-grabbing" : ""
      }`}
      data-testid={`photo-grid-${photo.id}`}
    >
      <img
        src={photo.imageUrl}
        alt="Uploaded"
        className={`w-full h-full object-cover pointer-events-none select-none ${
          isEditMode ? "animate-wiggle" : "transition-transform duration-500 group-hover:scale-110"
        }`}
        loading="lazy"
        draggable={false}
      />
      {!isEditMode && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
            <div className="text-[10px] text-white flex items-center truncate">
              <MapPin className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">
                {photo.locationName || `${photo.latitude.toFixed(2)}, ${photo.longitude.toFixed(2)}`}
              </span>
            </div>
          </div>
          <div className="absolute bottom-1 right-1 pointer-events-none">
            <DateStamp date={photo.takenAt || photo.createdAt} size="sm" />
          </div>
        </>
      )}
      {isEditMode && (
        <>
          <div className="absolute inset-0 border-2 border-white/30 pointer-events-none" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(photo.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1 right-1 z-10 w-5 h-5 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
            data-testid={`button-delete-photo-${photo.id}`}
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </>
      )}
    </div>
  );
}

interface SortablePhotoGridProps {
  photos: PhotoItem[];
}

export function SortablePhotoGrid({ photos: initialPhotos }: SortablePhotoGridProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [orderedPhotos, setOrderedPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeletePhoto();

  useEffect(() => {
    if (!isEditMode && !isSaving) {
      setOrderedPhotos(initialPhotos);
    }
  }, [initialPhotos, isEditMode, isSaving]);

  const reorderMutation = useMutation({
    mutationFn: async (photoIds: number[]) => {
      await apiRequest("PATCH", "/api/photos/reorder", { photoIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.photos.list.path], exact: false });
      toast({ title: "Photo order saved!" });
      setIsEditMode(false);
      setIsSaving(false);
    },
    onError: () => {
      toast({ title: "Failed to save photo order", variant: "destructive" });
      setOrderedPhotos(initialPhotos);
      setIsEditMode(false);
      setIsSaving(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 0, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedPhotos((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleConfirm = () => {
    setIsSaving(true);
    const photoIds = orderedPhotos.map((p) => p.id);
    reorderMutation.mutate(photoIds);
  };

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setIsEditMode(true);
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
    }, 500);
  }, [clearLongPress]);

  const handleDeletePhoto = useCallback((id: number) => {
    if (isSaving) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setOrderedPhotos((prev) => {
          const updated = prev.filter((p) => p.id !== id);
          if (updated.length === 0) {
            setIsEditMode(false);
          }
          return updated;
        });
        toast({ title: "Photo deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete photo", variant: "destructive" });
      },
    });
  }, [deleteMutation, toast, isSaving]);

  const activePhoto = activeId ? orderedPhotos.find((p) => p.id === activeId) : null;

  return (
    <div className="relative">
      {isEditMode && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground" data-testid="text-reorder-hint">Drag photos to reorder</p>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-colors shadow-lg"
            data-testid="button-confirm-reorder"
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Done
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedPhotos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-1">
            {orderedPhotos.map((photo, index) => (
              <SortablePhoto
                key={photo.id}
                photo={photo}
                isEditMode={isEditMode}
                isDragging={activeId === photo.id}
                onLongPressStart={startLongPress}
                onLongPressEnd={clearLongPress}
                onDelete={handleDeletePhoto}
                onDoubleTap={() => setViewerIndex(index)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activePhoto ? (
            <div className="aspect-square overflow-hidden bg-white/5 shadow-2xl ring-2 ring-primary rounded-sm opacity-90">
              <img
                src={activePhoto.imageUrl}
                alt="Dragging"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!isEditMode && initialPhotos.length > 1 && (
        <p className="text-center text-xs text-muted-foreground/50 mt-3" data-testid="text-longpress-hint">
          Long press any photo to reorder
        </p>
      )}

      {viewerIndex !== null && (
        <ProfilePhotoViewer
          photos={orderedPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
