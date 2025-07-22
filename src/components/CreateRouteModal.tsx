
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

  // ✅ LOG DE DEBUG PARA VERIFICAR DADOS DE EDIÇÃO
  useEffect(() => {
    if (editingRoute) {
      console.log('🔧 [CREATE ROUTE MODAL] Recebendo rota para edição:', {
        id: editingRoute.id,
        name: editingRoute.name,
        pointsCount: editingRoute.points?.length || 0,
        points: editingRoute.points?.map((p, i) => ({
          index: i,
          id: p.id,
          address: p.address.substring(0, 50) + '...',
          completed: p.completed
        }))
      });
    }
  }, [editingRoute]);

  const handleSubmit = async (routeData: any) => {
    if (isSubmitting) {
      console.log('⚠️ [CREATE ROUTE MODAL] Já está enviando, ignorando...');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('📤 [CREATE ROUTE MODAL] Iniciando salvamento:', {
        isEditing: !!editingRoute,
        routeName: routeData.name,
        pointsCount: routeData.points?.length || 0
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRoute ? `Editar Rota (${editingRoute.id.substring(0, 8)}...)` : 'Criar Nova Rota'} - Passo 2 de 2
          </DialogTitle>
          {editingRoute && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <strong>Debug:</strong> {editingRoute.points?.length || 0} pontos |{' '}
              {editingRoute.points?.filter(p => p.completed).length || 0} concluídos |{' '}
              Editando: {editingRoute.name}
            </div>
          )}
        </DialogHeader>
        
        <RouteForm 
          key={editingRoute ? `edit-${editingRoute.id}` : 'new'}
          onSubmit={handleSubmit} 
          editingRoute={editingRoute}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
