import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RouteUsage {
  route_name: string;
  execution_count: number;
  total_distance: number;
}

interface RouteUsageChartProps {
  data: RouteUsage[];
}

export const RouteUsageChart = ({ data }: RouteUsageChartProps) => {
  const chartData = data.map(item => ({
    name: item.route_name,
    execucoes: item.execution_count,
    distancia: Math.round(item.total_distance / 1000) // Convert to km
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso de Rotas</CardTitle>
        <CardDescription>Rotas mais executadas no período</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(142 76% 36%)" />
            <Tooltip />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="execucoes" 
              fill="hsl(var(--primary))" 
              name="Execuções"
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              yAxisId="right"
              dataKey="distancia" 
              fill="hsl(142 76% 36%)" 
              name="Distância (km)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
