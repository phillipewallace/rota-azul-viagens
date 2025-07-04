
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, TrendingUp, Users, Truck, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useReports } from '@/hooks/useReports';
import { PDFGenerator } from '@/components/PDFGenerator';
import { DateFilters } from '@/components/DateFilters';

const Management = () => {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const { getReportData, getReportStats, loading } = useReports();

  const handleExportReport = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ title: 'Selecione um mês e ano para gerar o relatório', variant: 'destructive' });
      return;
    }

    try {
      const data = await getReportData(selectedMonth, selectedYear);
      const pdfGenerator = new PDFGenerator();
      await pdfGenerator.generateManagementReport(data, `${selectedMonth}/${selectedYear}`);
      toast({ title: 'Relatório exportado com sucesso!' });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({ title: 'Erro ao exportar relatório', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Gestão" 
        subtitle="Relatórios e análises gerenciais"
      >
        <Button onClick={handleExportReport} disabled={loading || !selectedMonth || !selectedYear}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Relatório
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid gap-6">
          {/* Filtros de Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Filtros de Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DateFilters
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
              />
            </CardContent>
          </Card>

          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Viagens</p>
                    <p className="text-2xl font-bold">156</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Motoristas</p>
                    <p className="text-2xl font-bold">24</p>
                  </div>
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Caminhões</p>
                    <p className="text-2xl font-bold">18</p>
                  </div>
                  <Truck className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Rotas</p>
                    <p className="text-2xl font-bold">12</p>
                  </div>
                  <MapPin className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios Disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Relatório de Gestão Mensal</h3>
                    <p className="text-sm text-gray-600">
                      Relatório completo com dados de viagens, motoristas e caminhões
                    </p>
                  </div>
                  <Button 
                    onClick={handleExportReport}
                    disabled={loading || !selectedMonth || !selectedYear}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Management;
