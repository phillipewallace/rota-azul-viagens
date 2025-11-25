import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, Trash2, Search, Copy, MapPin } from 'lucide-react';
import { RoutePoint } from '@/hooks/useRoutes';
import { Badge } from '@/components/ui/badge';

interface RoutePointsListProps {
  points: RoutePoint[];
  onReorder: (points: RoutePoint[]) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  isDraggable: boolean;
  searchingAddress: number | null;
}

interface SortablePointProps {
  point: RoutePoint;
  index: number;
  isDraggable: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof RoutePoint, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  searchingAddress: number | null;
  totalPoints: number;
}

const SortablePoint: React.FC<SortablePointProps> = ({
  point,
  index,
  isDraggable,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  searchingAddress,
  totalPoints
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: point.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getPointTypeLabel = () => {
    if (index === 0) return 'Origem';
    if (index === totalPoints - 1) return 'Destino';
    return 'Parada';
  };

  const getPointTypeColor = () => {
    if (index === 0) return 'bg-green-500/10 text-green-700 border-green-200';
    if (index === totalPoints - 1) return 'bg-red-500/10 text-red-700 border-red-200';
    return 'bg-blue-500/10 text-blue-700 border-blue-200';
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`mb-4 ${isDragging ? 'shadow-2xl' : 'shadow-sm'} transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isDraggable && (
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing mt-2 hover:bg-muted/50 p-1 rounded transition-colors"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${getPointTypeColor()} px-2 py-1 text-xs font-medium border`}>
                    <MapPin className="h-3 w-3 mr-1" />
                    {getPointTypeLabel()} {index + 1}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicate(point.id)}
                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                    title="Duplicar ponto"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {totalPoints > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(point.id)}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`cep-${point.id}`} className="text-xs text-muted-foreground">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`cep-${point.id}`}
                      value={point.cep || ''}
                      onChange={(e) => onUpdate(point.id, 'cep', e.target.value)}
                      placeholder="00000-000"
                      className="text-sm h-9"
                      maxLength={9}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => point.cep && onSearchByCep(point.id, point.cep)}
                      disabled={!point.cep || point.cep.length < 8}
                      className="h-9 w-9 p-0"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`address-${point.id}`} className="text-xs text-muted-foreground">Endereço</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`address-${point.id}`}
                      value={point.address || ''}
                      onChange={(e) => onUpdate(point.id, 'address', e.target.value)}
                      placeholder="Digite o endereço..."
                      className="text-sm h-9"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => point.address && onSearchByAddress(point.id, point.address)}
                      disabled={!point.address || point.address.length < 5}
                      className="h-9 w-9 p-0"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`lat-${point.id}`} className="text-xs text-muted-foreground">Latitude</Label>
                  <Input
                    id={`lat-${point.id}`}
                    value={point.lat || ''}
                    readOnly
                    className="text-sm h-9 bg-muted/30"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <Label htmlFor={`lng-${point.id}`} className="text-xs text-muted-foreground">Longitude</Label>
                  <Input
                    id={`lng-${point.id}`}
                    value={point.lng || ''}
                    readOnly
                    className="text-sm h-9 bg-muted/30"
                    placeholder="Auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const RoutePointsList: React.FC<RoutePointsListProps> = ({
  points,
  onReorder,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  isDraggable,
  searchingAddress
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((p) => p.id === active.id);
      const newIndex = points.findIndex((p) => p.id === over.id);

      const newPoints = arrayMove(points, oldIndex, newIndex);
      onReorder(newPoints);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={points.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        {points.map((point, index) => (
          <SortablePoint
            key={point.id}
            point={point}
            index={index}
            isDraggable={isDraggable}
            onRemove={onRemove}
            onUpdate={onUpdate}
            onSearchByCep={onSearchByCep}
            onSearchByAddress={onSearchByAddress}
            onDuplicate={onDuplicate}
            searchingAddress={searchingAddress}
            totalPoints={points.length}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};
