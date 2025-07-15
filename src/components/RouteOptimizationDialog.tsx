
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
import { Brain, Settings } from 'lucide-react';

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
      <AlertDialogContent className="sm:max-w-lg mx-4 sm:mx-auto">
        <AlertDialogHeader className="text-center space-y-3">
          <AlertDialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <Settings className="h-6 w-6" />
            Escolha o Tipo de Otimização
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-muted-foreground">
            Como você gostaria de otimizar esta rota?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 my-6">
          {/* Otimização Inteligente */}
          <div 
            className="group cursor-pointer p-4 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 animate-fade-in"
            onClick={handleIntelligentOptimization}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-blue-800 mb-1">
                  Otimização Inteligente
                </h3>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Preserva pontos já concluídos e otimiza apenas os pendentes. 
                  Ideal para rotas em andamento.
                </p>
              </div>
            </div>
          </div>
          
          {/* Otimização Tradicional */}
          <div 
            className="group cursor-pointer p-4 rounded-lg border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 animate-fade-in"
            onClick={handleTraditionalOptimization}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white">
                <Settings className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  Otimização Tradicional
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Otimização completa de todos os pontos. 
                  Ideal para rotas novas ou recalculo total.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
          <AlertDialogCancel 
            disabled={isOptimizing}
            className="w-full sm:w-auto"
          >
            Cancelar
          </AlertDialogCancel>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <AlertDialogAction
              onClick={handleTraditionalOptimization}
              disabled={isOptimizing}
              className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Tradicional
            </AlertDialogAction>
            
            <AlertDialogAction
              onClick={handleIntelligentOptimization}
              disabled={isOptimizing}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Brain className="w-4 h-4 mr-2" />
              Inteligente
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RouteOptimizationDialog;
