
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RouteOptimizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (useIntelligent: boolean) => void;
  isOptimizing: boolean;
}

const RouteOptimizationDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isOptimizing 
}: RouteOptimizationDialogProps) => {
  const handleIntelligentOptimization = () => {
    onConfirm(true);
    onOpenChange(false);
  };

  const handleTraditionalOptimization = () => {
    onConfirm(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>🚛 Rota em Uso?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Para otimizar corretamente, precisamos saber se esta rota está sendo usada atualmente por algum caminhão.
            </p>
            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
              <p className="text-sm">
                <strong>🧠 Rota EM USO:</strong> Preserva pontos já concluídos e otimiza apenas os pendentes
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
              <p className="text-sm">
                <strong>🆓 Rota LIVRE:</strong> Otimização completa de todos os pontos
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isOptimizing}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleTraditionalOptimization}
            disabled={isOptimizing}
            className="bg-gray-600 hover:bg-gray-700"
          >
            🆓 Rota Livre (Otimização Completa)
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleIntelligentOptimization}
            disabled={isOptimizing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            🧠 Rota em Uso (Otimização Inteligente)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RouteOptimizationDialog;
