import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { GripVertical, ArrowLeft, Save, Plus, MapPin, CheckCircle2 } from 'lucide-react';
import { useMobile } from '@/hooks/useMobile';
import AddStopModal from '@/components/AddStopModal';
import { sharedLocationStore } from '@/store/sharedLocationStore';

interface RoutePoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: string;
  completed: boolean;
  name?: string;
  stopType?: string;
}

interface StopsListProps {
  routeId: string;
  truckId: string;
  initialPoints: RoutePoint[];
  onBack: () => void;
}

function SortableStopItem({ point, index }: { point: RoutePoint; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: point.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border shadow-sm p-4 mb-2"
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1"
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-blue-600">
              Parada {index + 1}
            </span>
            {point.completed && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            {point.stopType && (
              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                {point.stopType}
              </span>
            )}
          </div>
          
          <p className="text-sm font-medium text-gray-900 mb-1">
            {point.name || 'Cliente'}
          </p>
          
          <p className="text-xs text-gray-600 break-words">
            <MapPin className="h-3 w-3 inline mr-1" />
            {point.address}
          </p>
        </div>
      </div>
    </div>
  );
}

const StopsList: React.FC<StopsListProps> = ({ 
  routeId, 
  truckId, 
  initialPoints, 
  onBack 
}) => {
  const navigate = useNavigate();
  const [points, setPoints] = useState<RoutePoint[]>(initialPoints);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { reorderStops, addExtraStop } = useMobile();

  // Verificar se há localização compartilhada ao montar
  useEffect(() => {
    const sharedState = sharedLocationStore.getState();
    if (sharedState.isFromShare && sharedState.sharedContent) {
      console.log('📍 [STOPS LIST] Abrindo modal com localização compartilhada');
      setShowAddModal(true);
    }
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPoints((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Atualizar ordem
        return reorderedItems.map((item, idx) => ({
          ...item,
          order: idx
        }));
      });
      
      setHasChanges(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!hasChanges) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }

    setSaving(true);

    try {
      // Preparar dados para enviar ao backend
      const reorderedPoints = points.map((point, index) => ({
        pointId: point.id,
        order: index
      }));

      console.log('💾 [STOPS LIST] Salvando reordenação:', reorderedPoints);

      await reorderStops(routeId, reorderedPoints);

      toast.success('Ordem das paradas salva com sucesso!');
      setHasChanges(false);
      
    } catch (error) {
      console.error('❌ [STOPS LIST] Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStop = async (stopData: {
    name: string;
    stopType: string;
    location: string;
    insertBeforeId?: string;
  }) => {
    try {
      console.log('➕ [STOPS LIST] Adicionando parada extra:', stopData);

      const newStop = await addExtraStop(routeId, truckId, stopData);

      // Atualizar lista local
      let newPoints = [...points];
      
      if (stopData.insertBeforeId) {
        // Inserir antes de uma parada específica
        const insertIndex = newPoints.findIndex(p => p.id === stopData.insertBeforeId);
        if (insertIndex >= 0) {
          newPoints.splice(insertIndex, 0, newStop);
        } else {
          newPoints.push(newStop);
        }
      } else {
        // Adicionar no final
        newPoints.push(newStop);
      }

      // Renumerar
      newPoints = newPoints.map((p, idx) => ({ ...p, order: idx }));

      setPoints(newPoints);
      setShowAddModal(false);
      setHasChanges(true);
      
      // Limpar conteúdo compartilhado
      sharedLocationStore.clearSharedContent();

      toast.success('Parada extra adicionada!');
      
    } catch (error) {
      console.error('❌ [STOPS LIST] Erro ao adicionar parada:', error);
      toast.error('Erro ao adicionar parada extra');
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      const confirm = window.confirm(
        'Você tem alterações não salvas. Deseja sair sem salvar?'
      );
      if (!confirm) return;
    }
    
    onBack();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            <Button
              onClick={handleSaveChanges}
              disabled={!hasChanges || saving}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>

          <h1 className="text-xl font-semibold text-gray-900">
            Lista de Paradas da Rota
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Arraste para reordenar as paradas
          </p>
        </div>
      </div>

      {/* Stops List */}
      <div className="p-4">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={points.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {points.map((point, index) => (
              <SortableStopItem
                key={point.id}
                point={point}
                index={index}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Botão Adicionar Parada */}
        <Button
          onClick={() => setShowAddModal(true)}
          variant="outline"
          className="w-full mt-4 gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar parada extra
        </Button>
      </div>

      {/* Modal Adicionar Parada */}
      {showAddModal && (
        <AddStopModal
          points={points}
          onClose={() => {
            setShowAddModal(false);
            sharedLocationStore.clearSharedContent();
          }}
          onAdd={handleAddStop}
        />
      )}
    </div>
  );
};

export default StopsList;
