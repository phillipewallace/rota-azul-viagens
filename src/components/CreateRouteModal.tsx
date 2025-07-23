
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

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (savedRoute: Route) => {
    try {
      setIsSubmitting(true);
      console.log('✅ [CREATE ROUTE MODAL] Rota salva com sucesso:', savedRoute.id);
      
      // Fechar modal
      onOpenChange(false);
      
      // Aguardar um pouco para garantir que o modal feche
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Executar callback de sucesso
      if (onSuccess) {
        console.log('🔄 [CREATE ROUTE MODAL] Executando callback de sucesso');
        await onSuccess();
      }
      
    } catch (error: any) {
      console.error('❌ [CREATE ROUTE MODAL] Erro no callback:', error);
      toast.error('Erro ao processar callback');
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
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteModal;
