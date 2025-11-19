
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExecutionDetail } from "@/services/analytics";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, CheckCircle, Clock } from "lucide-react";

interface ExecutionDetailsProps {
  execution: ExecutionDetail | null;
  open: boolean;
  onClose: () => void;
}

export const ExecutionDetails = ({ execution, open, onClose }: ExecutionDetailsProps) => {
  if (!execution) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Concluída</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-yellow-600">Em Progresso</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{execution.routeName}</span>
            {getStatusBadge(execution.status)}
          </DialogTitle>
          <DialogDescription>
            {execution.routeDescription || 'Sem descrição'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Gerais */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Caminhão</h4>
              <p>{execution.truck.name}</p>
              <p className="text-sm text-muted-foreground">{execution.truck.plate} - {execution.truck.model}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Motorista</h4>
              {execution.driver ? (
                <>
                  <p>{execution.driver.name}</p>
                  <p className="text-sm text-muted-foreground">{execution.driver.phone}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Não atribuído</p>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                Pontos
              </div>
              <p className="text-xl font-bold">{execution.pointsCompleted}/{execution.totalPoints}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                Conclusão
              </div>
              <p className="text-xl font-bold">{execution.completionPercentage.toFixed(1)}%</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Duração
              </div>
              <p className="text-xl font-bold">
                {execution.actualDuration 
                  ? `${Math.floor(execution.actualDuration / 60)}h ${execution.actualDuration % 60}min`
                  : 'Em andamento'
                }
              </p>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-1">Início</h4>
              <p className="text-sm">
                {format(new Date(execution.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {execution.completedAt && (
              <div>
                <h4 className="font-semibold mb-1">Conclusão</h4>
                <p className="text-sm">
                  {format(new Date(execution.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>

          {/* Pontos Snapshot */}
          <div>
            <h4 className="font-semibold mb-3">Pontos da Rota</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {execution.pointsSnapshot.map((point: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {point.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{point.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {point.type === 'origin' ? 'Origem' : point.type === 'destination' ? 'Destino' : 'Parada'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={point.completed ? "default" : "secondary"}>
                    {point.completed ? 'Concluído' : 'Pendente'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
