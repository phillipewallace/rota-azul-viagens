
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendData } from "@/services/analytics";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrendsChartProps {
  data: TrendData[];
}

export const TrendsChart = ({ data }: TrendsChartProps) => {
  const chartData = data.map(item => ({
    ...item,
    formattedDate: format(new Date(item.date), 'dd/MM', { locale: ptBR })
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendências de Execução</CardTitle>
        <CardDescription>Evolução das rotas ao longo do tempo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="formattedDate" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="routesCount" 
              stroke="hsl(var(--primary))" 
              name="Total de Rotas"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="completedCount" 
              stroke="hsl(142 76% 36%)" 
              name="Rotas Concluídas"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="avgCompletion" 
              stroke="hsl(221 83% 53%)" 
              name="% Conclusão Média"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
