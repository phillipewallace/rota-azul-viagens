
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
import { Brain, Settings, Loader2, Zap, CheckCircle } from 'lucide-react';

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
    console.log('🧠 [DIALOG] Usuário escolheu: OTIMIZAÇÃO INTELIGENTE');
    onConfirm(true);
  };

  const handleTraditionalOptimization = () => {
    console.log('🔄 [DIALOG] Usuário escolheu: OTIMIZAÇÃO TRADICIONAL');
    onConfirm(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader className="text-center space-y-4 pb-6">
          <AlertDialogTitle className="text-2xl font-bold flex items-center justify-center gap-3">
            {isOptimizing ? (
              <>
                <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
                Otimizando Rota...
              </>
            ) : (
              <>
                <Zap className="h-7 w-7 text-blue-600" />
                Escolha o Tipo de Otimização
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lg text-muted-foreground">
            {isOptimizing 
              ? "Aguarde enquanto otimizamos sua rota. Isso pode levar alguns segundos..."
              : "Selecione como você gostaria de otimizar esta rota:"
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {!isOptimizing && (
          <div className="space-y-4 py-6">
            {/* Otimização Inteligente */}
            <div 
              className="group cursor-pointer p-6 rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 hover:border-blue-400 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300"
              onClick={handleIntelligentOptimization}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-blue-600 group-hover:bg-blue-700 flex items-center justify-center text-white shadow-lg">
                  <Brain className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-2 text-blue-800 group-hover:text-blue-900">
                    🧠 Otimização Inteligente
                    <span className="ml-2 text-xs font-normal bg-green-200 text-green-800 px-2 py-1 rounded-full">
                      RECOMENDADO
                    </span>
                  </h3>
                  <p className="text-base leading-relaxed text-blue-700 group-hover:text-blue-800">
                    Preserva pontos já concluídos e otimiza apenas os pendentes. 
                    Mantém o progresso atual e calcula a melhor sequência para os pontos restantes.
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Preserva progresso
                    </div>
                    <div className="flex items-center gap-2 text-blue-600">
                      <Zap className="w-4 h-4" />
                      Otimiza pendentes
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Otimização Tradicional */}
            <div 
              className="group cursor-pointer p-6 rounded-xl border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 hover:shadow-md transition-all duration-300"
              onClick={handleTraditionalOptimization}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gray-600 group-hover:bg-gray-700 flex items-center justify-center text-white shadow-lg">
                  <Settings className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-2 text-gray-800 group-hover:text-gray-900">
                    🔄 Otimização Tradicional
                  </h3>
                  <p className="text-base leading-relaxed text-gray-700 group-hover:text-gray-800">
                    Otimização completa de todos os pontos da rota. 
                    Recalcula a melhor sequência ignorando o status atual dos pontos.
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-orange-600">
                      <Settings className="w-4 h-4" />
                      Recomeça do zero
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Zap className="w-4 h-4" />
                      Otimização total
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isOptimizing && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <p className="text-gray-600">
              Processando otimização inteligente...
            </p>
            <div className="mt-4 max-w-md mx-auto bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        )}
        
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <AlertDialogCancel 
            disabled={isOptimizing}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            {isOptimizing ? 'Aguarde...' : 'Cancelar'}
          </AlertDialogCancel>
          
          {!isOptimizing && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
              <AlertDialogAction
                onClick={handleTraditionalOptimization}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Tradicional
              </AlertDialogAction>
              
              <AlertDialogAction
                onClick={handleIntelligentOptimization}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Brain className="w-4 h-4 mr-2" />
                Inteligente
              </AlertDialogAction>
            </div>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RouteOptimizationDialog;
