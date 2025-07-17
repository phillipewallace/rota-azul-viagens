
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
  
  // Debug logs
  React.useEffect(() => {
    console.log('🎯 [OPTIMIZATION DIALOG] Estado atual:', { open, isOptimizing });
  }, [open, isOptimizing]);

  const handleIntelligentOptimization = () => {
    console.log('🧠 [OPTIMIZATION DIALOG] Usuário escolheu: INTELIGENTE');
    onConfirm(true);
  };

  const handleTraditionalOptimization = () => {
    console.log('🆓 [OPTIMIZATION DIALOG] Usuário escolheu: TRADICIONAL');
    onConfirm(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold">
            🚛 Escolha o Tipo de Otimização
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p className="text-sm text-gray-600">
              Como você gostaria de otimizar esta rota?
            </p>
            
            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-medium">🧠</span>
                <div>
                  <p className="font-medium text-blue-800">Otimização Inteligente</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Preserva pontos já concluídos e otimiza apenas os pendentes. 
                    Ideal para rotas em andamento.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
              <div className="flex items-start gap-2">
                <span className="text-gray-600 font-medium">🆓</span>
                <div>
                  <p className="font-medium text-gray-800">Otimização Tradicional</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Otimização completa de todos os pontos. 
                    Ideal para rotas novas ou planejamento geral.
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel 
            disabled={isOptimizing}
            className="w-full sm:w-auto"
          >
            Cancelar
          </AlertDialogCancel>
          
          <AlertDialogAction
            onClick={handleTraditionalOptimization}
            disabled={isOptimizing}
            className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white"
          >
            🆓 Otimização Tradicional
          </AlertDialogAction>
          
          <AlertDialogAction
            onClick={handleIntelligentOptimization}
            disabled={isOptimizing}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            🧠 Otimização Inteligente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RouteOptimizationDialog;
