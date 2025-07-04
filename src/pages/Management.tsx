import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Filter, TrendingUp, Users, Truck, Calendar } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const Management = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const managementData = [
    { id: '1', name: 'Viagem #101', month: '2024-01', status: 'completed', date: '2024-01-15', value: 3200 },
    { id: '2', name: 'Manutenção #202', month: '2024-01', status: 'completed', date: '2024-01-20', value: 800 },
    { id: '3', name: 'Viagem #102', month: '2024-02', status: 'in-progress', date: '2024-02-05', value: 2800 },
    { id: '4', name: 'Abastecimento #301', month: '2024-02', status: 'completed', date: '2024-02-10', value: 550 },
    { id: '5', name: 'Viagem #103', month: '2024-03', status: 'pending', date: '2024-03-01', value: 4100 },
    { id: '6', name: 'Manutenção #203', month: '2024-03', status: 'completed', date: '2024-03-12', value: 1200 },
    { id: '7', name: 'Viagem #104', month: '2024-04', status: 'completed', date: '2024-04-18', value: 3500 },
    { id: '8', name: 'Abastecimento #302', month: '2024-04', status: 'cancelled', date: '2024-04-22', value: 600 },
    { id: '9', name: 'Viagem #105', month: '2024-05', status: 'completed', date: '2024-05-10', value: 3900 },
    { id: '10', name: 'Manutenção #204', month: '2024-05', status: 'in-progress', date: '2024-05-25', value: 900 },
    { id: '11', name: 'Viagem #106', month: '2024-06', status: 'completed', date: '2024-06-05', value: 4200 },
    { id: '12', name: 'Abastecimento #303', month: '2024-06', status: 'completed', date: '2024-06-15', value: 580 }
  ];

  const statusLabels = {
    'completed': 'Concluído',
    'in-progress': 'Em Progresso',
    'pending': 'Pendente',
    'cancelled': 'Cancelado'
  };

  const statusColors = {
    'completed': 'green',
    'in-progress': 'blue',
    'pending': 'orange',
    'cancelled': 'red'
  };

  const generatePDF = () => {
    try {
      const { pdfGenerator } = require('@/components/PDFGenerator');
      const filteredData = getFilteredData();
      pdfGenerator.generateManagementReport(filteredData, selectedMonth);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar relatório PDF');
    }
  };

  const getFilteredData = () => {
    let filtered = managementData;
    
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(item => item.month === selectedMonth);
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => item.status === selectedStatus);
    }
    
    return filtered;
  };

  const filteredData = getFilteredData();

  const monthlySummary = managementData.reduce((acc, item) => {
    const month = item.month;
    if (!acc[month]) {
      acc[month] = { month: month, totalValue: 0 };
    }
    acc[month].totalValue += item.value;
    return acc;
  }, {});

  const chartData = Object.values(monthlySummary);

  const totalUsers = 50;
  const activeUsers = 42;
  const newUsers = 8;

  const totalTrucks = 20;
  const trucksInRoute = 15;
  const availableTrucks = 5;

  const upcomingMaintenance = [
    { truck: 'Caminhão #1', date: '2024-07-10' },
    { truck: 'Caminhão #2', date: '2024-07-15' },
    { truck: 'Caminhão #3', date: '2024-07-20' }
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader title="Gestão" subtitle="Painel de controle e indicadores">
        <Button onClick={generatePDF} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Gerar PDF
        </Button>
      </PageHeader>
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <div className="flex gap-4">
                <div>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      <SelectItem value="2024-01">Janeiro 2024</SelectItem>
                      <SelectItem value="2024-02">Fevereiro 2024</SelectItem>
                      <SelectItem value="2024-03">Março 2024</SelectItem>
                      <SelectItem value="2024-04">Abril 2024</SelectItem>
                      <SelectItem value="2024-05">Maio 2024</SelectItem>
                      <SelectItem value="2024-06">Junho 2024</SelectItem>
                      <SelectItem value="2024-07">Julho 2024</SelectItem>
                      <SelectItem value="2024-08">Agosto 2024</SelectItem>
                      <SelectItem value="2024-09">Setembro 2024</SelectItem>
                      <SelectItem value="2024-10">Outubro 2024</SelectItem>
                      <SelectItem value="2024-11">Novembro 2024</SelectItem>
                      <SelectItem value="2024-12">Dezembro 2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="in-progress">Em Progresso</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 mr-1 inline-block" />
                {activeUsers} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Caminhões</CardTitle>
              <Truck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTrucks}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 mr-1 inline-block" />
                {trucksInRoute} em rota
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximas Manutenções</CardTitle>
              <Calendar className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingMaintenance.length}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 mr-1 inline-block" />
                Este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos Usuários</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{newUsers}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 mr-1 inline-block" />
                Últimos 30 dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Resumo Mensal */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Resumo Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalValue" fill="#8884d8" name="Valor Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela de Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Dados de Gestão</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mês
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Badge variant="secondary" className={`bg-${statusColors[item.status]}-100 text-${statusColors[item.status]}-800`}>
                        {statusLabels[item.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {item.value.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Management;
