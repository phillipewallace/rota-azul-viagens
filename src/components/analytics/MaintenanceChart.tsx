import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface MaintenanceSummary {
  type: string;
  count: number;
  total_cost: number;
}

interface MaintenanceChartProps {
  data: MaintenanceSummary[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(142 76% 36%)', 'hsl(45 93% 47%)', 'hsl(0 84% 60%)'];

export const MaintenanceChart = ({ data }: MaintenanceChartProps) => {
  const chartData = data.map(item => ({
    name: item.type,
    value: item.count,
    cost: item.total_cost || 0
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manutenções por Tipo</CardTitle>
        <CardDescription>Distribuição de manutenções realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: any, name: string, props: any) => [
                `${value} manutenções${props.payload.cost ? ` - R$ ${props.payload.cost.toFixed(2)}` : ''}`,
                name
              ]} 
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
