import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  total_executions: number;
  total_distance: number;
}

interface MonthlyPerformanceChartProps {
  data: MonthlyData[];
}

export const MonthlyPerformanceChart = ({ data }: MonthlyPerformanceChartProps) => {
  const chartData = data.map(item => ({
    month: format(new Date(item.month + '-01'), 'MMM/yy', { locale: ptBR }),
    execucoes: item.total_executions,
    distancia: Math.round(item.total_distance / 1000) // Convert to km
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Mensal</CardTitle>
        <CardDescription>Evolução das execuções e distância percorrida</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(142 76% 36%)" />
            <Tooltip />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="execucoes" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Execuções"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="distancia" 
              stroke="hsl(142 76% 36%)" 
              strokeWidth={2}
              name="Distância (km)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
