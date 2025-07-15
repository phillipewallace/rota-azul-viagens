
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
  
  React.useEffect(() => {
    console.log('🎯🎯🎯 [OPTIMIZATION DIALOG] Estado atual:', { open, isOptimizing });
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
      <AlertDialogContent className="max-w-2xl mx-auto">
        <AlertDialogHeader className="text-center">
          <AlertDialogTitle className="text-2xl font-bold flex items-center justify-center gap-2 mb-4">
            🚛 Escolha o Tipo de Otimização
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-gray-600 mb-6">
            Como você gostaria de otimizar esta rota?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 mb-6">
          {/* Otimização Inteligente */}
          <div 
            className="group cursor-pointer p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
            onClick={handleIntelligentOptimization}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                🧠
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Otimização Inteligente
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Preserva pontos já concluídos e otimiza apenas os pendentes. 
                  Ideal para rotas em andamento onde você não quer alterar a sequência dos pontos já visitados.
                </p>
              </div>
            </div>
          </div>
          
          {/* Otimização Tradicional */}
          <div 
            className="group cursor-pointer p-4 rounded-lg border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
            onClick={handleTraditionalOptimization}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                🆓
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Otimização Tradicional
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Otimização completa de todos os pontos sem considerar status anterior. 
                  Ideal para rotas novas ou quando você quer recalcular tudo do zero.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <AlertDialogCancel 
            disabled={isOptimizing}
            className="w-full sm:w-auto order-last sm:order-first"
          >
            Cancelar
          </AlertDialogCancel>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <AlertDialogAction
              onClick={handleTraditionalOptimization}
              disabled={isOptimizing}
              className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white flex items-center justify-center gap-2"
            >
              <span>🆓</span>
              Otimização Tradicional
            </AlertDialogAction>
            
            <AlertDialogAction
              onClick={handleIntelligentOptimization}
              disabled={isOptimizing}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <span>🧠</span>
              Otimização Inteligente
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RouteOptimizationDialog;
