
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RouteForm from './RouteForm';
import { Route } from '@/hooks/useRoutes';
import { toast } from 'sonner';

interface CreateRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRoute?: Route | null;
  onSuccess?: () => void;
}

const CreateRouteModal = ({ open, onOpenChange, editingRoute, onSuccess }: CreateRouteModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ LIMPAR ESTADO AO FECHAR MODAL
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  // ✅ LOG DE DEBUG PARA VERIFICAR DADOS DE EDIÇÃO COM VALIDAÇÕES
  useEffect(() => {
    if (editingRoute && editingRoute.id) {
      // ✅ VALIDAR DADOS DA ROTA ANTES DE USAR
      const safePoints = Array.isArray(editingRoute.points) ? editingRoute.points : [];
      
      console.log('🔧 [CREATE ROUTE MODAL] Recebendo rota para edição:', {
        id: editingRoute.id,
        name: editingRoute.name || 'Nome não definido',
        pointsCount: safePoints.length,
        points: safePoints.map((p, i) => ({
          index: i,
          id: p?.id || `point-${i}`,
          address: p?.address ? p.address.substring(0, 50) + '...' : 'Endereço não definido',
          completed: p?.completed || false
        }))
      });
    }
  }, [editingRoute]);

  const handleSubmit = async (routeData: any) => {
    if (isSubmitting) {
      console.log('⚠️ [CREATE ROUTE MODAL] Já está enviando, ignorando...');
      return;
    }

    // ✅ VALIDAR DADOS ANTES DE PROCESSAR
    if (!routeData) {
      console.error('❌ [CREATE ROUTE MODAL] Dados da rota inválidos');
      toast.error('Erro: dados da rota inválidos');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('📤 [CREATE ROUTE MODAL] Iniciando salvamento:', {
        isEditing: !!editingRoute,
        routeName: routeData.name || 'Nome não definido',
        pointsCount: Array.isArray(routeData.points) ? routeData.points.length : 0
      });

      // ✅ AGUARDAR UM MOMENTO PARA GARANTIR QUE OS DADOS FORAM SALVOS
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ [CREATE ROUTE MODAL] Rota salva, fechando modal');
      
      // ✅ FECHAR MODAL PRIMEIRO
      onOpenChange(false);
      
      // ✅ AGUARDAR UM MOMENTO ANTES DE EXECUTAR CALLBACK
      setTimeout(() => {
        if (onSuccess) {
          console.log('🔄 [CREATE ROUTE MODAL] Executando callback de sucesso');
          onSuccess();
        }
      }, 300);

      toast.success(editingRoute ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
      
    } catch (error: any) {
      console.error('❌ [CREATE ROUTE MODAL] Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar rota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    console.log('❌ [CREATE ROUTE MODAL] Cancelando edição/criação');
    onOpenChange(false);
  };

  // ✅ VALIDAR editingRoute ANTES DE USAR
  const safeEditingRoute = editingRoute && editingRoute.id ? {
    ...editingRoute,
    points: Array.isArray(editingRoute.points) ? editingRoute.points : [],
    totalDistance: editingRoute.totalDistance || 0,
    estimatedTime: editingRoute.estimatedTime || '0min',
    optimizedOrder: Array.isArray(editingRoute.optimizedOrder) ? editingRoute.optimizedOrder : []
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {safeEditingRoute ? `Editar Rota (${safeEditingRoute.id.substring(0, 8)}...)` : 'Criar Nova Rota'} - Passo 2 de 2
          </DialogTitle>
          {safeEditingRoute && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <strong>Debug:</strong> {safeEditingRoute.points.length} pontos |{' '}
              {safeEditingRoute.points.filter(p => p?.completed).length} concluídos |{' '}
              Editando: {safeEditingRoute.name || 'Nome não definido'}
            </div>
          )}
        </DialogHeader>
        
        <RouteForm 
          key={safeEditingRoute ? `edit-${safeEditingRoute.id}` : 'new'}
          onSubmit={handleSubmit} 
          editingRoute={safeEditingRoute}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
