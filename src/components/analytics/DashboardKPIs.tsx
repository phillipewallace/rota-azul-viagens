
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, CheckCircle, Clock, XCircle, MapPin, Truck, Users } from "lucide-react";
import { DashboardKPIs as KPIData } from "@/services/analytics";

interface DashboardKPIsProps {
  data: KPIData;
}

export const DashboardKPIs = ({ data }: DashboardKPIsProps) => {
  const kpiCards = [
    {
      title: "Total de Rotas",
      value: data.totalRoutes,
      icon: TrendingUp,
      color: "text-blue-600"
    },
    {
      title: "Rotas Concluídas",
      value: data.completedRoutes,
      icon: CheckCircle,
      color: "text-green-600"
    },
    {
      title: "Rotas Ativas",
      value: data.activeRoutes,
      icon: Clock,
      color: "text-yellow-600"
    },
    {
      title: "Rotas Canceladas",
      value: data.cancelledRoutes,
      icon: XCircle,
      color: "text-red-600"
    },
    {
      title: "Pontos Completados",
      value: `${data.totalPointsCompleted}/${data.totalPointsPlanned}`,
      icon: MapPin,
      color: "text-purple-600"
    },
    {
      title: "Distância Total",
      value: `${data.totalDistance.toFixed(1)} km`,
      icon: TrendingUp,
      color: "text-indigo-600"
    },
    {
      title: "Média de Conclusão",
      value: `${data.avgCompletion.toFixed(1)}%`,
      icon: CheckCircle,
      color: "text-teal-600"
    },
    {
      title: "Caminhões Usados",
      value: data.trucksUsed,
      icon: Truck,
      color: "text-orange-600"
    },
    {
      title: "Motoristas Ativos",
      value: data.driversActive,
      icon: Users,
      color: "text-cyan-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpiCards.map((kpi, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
