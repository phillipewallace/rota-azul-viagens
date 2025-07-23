
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

  // Limpar estado ao fechar modal
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (routeData: any) => {
    if (isSubmitting) {
      console.log('⚠️ [CREATE ROUTE MODAL] Já está enviando, ignorando...');
      return;
    }

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

      // Aguardar salvamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ [CREATE ROUTE MODAL] Rota salva, fechando modal');
      
      // Fechar modal
      onOpenChange(false);
      
      // Executar callback de sucesso após fechar
      if (onSuccess) {
        setTimeout(() => {
          console.log('🔄 [CREATE ROUTE MODAL] Executando callback de sucesso');
          onSuccess();
        }, 500);
      }

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
            {editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}
          </DialogTitle>
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
