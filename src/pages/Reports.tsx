
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Truck, Route } from 'lucide-react';

const Reports = () => {
  const stats = [
    { title: 'Total de Rotas', value: '24', icon: Route, color: 'text-blue-500' },
    { title: 'Caminhões Ativos', value: '12', icon: Truck, color: 'text-green-500' },
    { title: 'Km Percorridos', value: '15.420', icon: TrendingUp, color: 'text-purple-500' },
    { title: 'Entregas', value: '89', icon: BarChart3, color: 'text-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Relatórios</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                Gráfico de desempenho será implementado aqui
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rotas Mais Utilizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['SP → RJ', 'SP → MG', 'SP → PR'].map((route, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>{route}</span>
                    <span className="font-semibold">{15 - index * 2} viagens</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Reports;
