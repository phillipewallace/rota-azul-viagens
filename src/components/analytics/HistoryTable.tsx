
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { RouteExecution } from "@/services/analytics";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryTableProps {
  data: RouteExecution[];
  onViewDetails: (execution: RouteExecution) => void;
}

export const HistoryTable = ({ data, onViewDetails }: HistoryTableProps) => {
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

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma execução encontrada
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rota</TableHead>
            <TableHead>Caminhão</TableHead>
            <TableHead>Motorista</TableHead>
            <TableHead>Pontos</TableHead>
            <TableHead>Distância</TableHead>
            <TableHead>Conclusão</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((execution) => (
            <TableRow key={execution.id}>
              <TableCell className="font-medium">{execution.routeName}</TableCell>
              <TableCell>
                {execution.truckName}
                <br />
                <span className="text-xs text-muted-foreground">{execution.truckPlate}</span>
              </TableCell>
              <TableCell>{execution.driverName || '-'}</TableCell>
              <TableCell>
                {execution.pointsCompleted}/{execution.totalPoints}
              </TableCell>
              <TableCell>{execution.totalDistance.toFixed(1)} km</TableCell>
              <TableCell>{execution.completionPercentage.toFixed(1)}%</TableCell>
              <TableCell>
                {format(new Date(execution.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>{getStatusBadge(execution.status)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(execution)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Detalhes
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
