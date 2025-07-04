
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportStats } from '@/hooks/useReports';

export class PDFGenerator {
  private doc: jsPDF;

  constructor() {
    this.doc = new jsPDF();
  }

  static generateSystemReport(stats: ReportStats | null, selectedMonth?: string) {
    try {
      if (!stats) {
        throw new Error('Dados de estatísticas não disponíveis');
      }

      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(20);
      pdf.text('Relatório do Sistema', 20, 20);
      
      if (selectedMonth && selectedMonth !== 'all') {
        pdf.setFontSize(12);
        pdf.text(`Período: ${selectedMonth}`, 20, 30);
      }
      
      // Estatísticas gerais
      pdf.setFontSize(16);
      pdf.text('Estatísticas Gerais', 20, 50);
      
      const statsData = [
        ['Total de Rotas', stats.totalRoutes?.toString() || '0'],
        ['Rotas Ativas', stats.activeRoutes?.toString() || '0'],
        ['Total de Caminhões', stats.totalTrucks?.toString() || '0'],
        ['Caminhões Disponíveis', stats.availableTrucks?.toString() || '0'],
        ['Viagens Concluídas', stats.completedTrips?.toString() || '0'],
        ['Quilometragem Total', `${stats.totalKm?.toLocaleString() || '0'} km`],
        ['Manutenções Pendentes', stats.pendingMaintenance?.toString() || '0']
      ];

      autoTable(pdf, {
        startY: 60,
        head: [['Métrica', 'Valor']],
        body: statsData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      // Footer
      pdf.setFontSize(10);
      pdf.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
        20,
        pdf.internal.pageSize.height - 20
      );
      
      // Salvar arquivo
      const fileName = `relatorio-sistema-${selectedMonth || 'geral'}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }

  static generateManagementReport(data: any[], month: string) {
    try {
      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(20);
      pdf.text('Relatório de Gestão', 20, 20);
      
      pdf.setFontSize(12);
      pdf.text(`Período: ${month}`, 20, 30);
      
      // Dados da tabela
      if (data && data.length > 0) {
        const tableData = data.map(item => [
          item.id || '',
          item.name || '',
          item.status || '',
          item.date || '',
          item.value || ''
        ]);

        autoTable(pdf, {
          startY: 50,
          head: [['ID', 'Nome', 'Status', 'Data', 'Valor']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] }
        });
      } else {
        pdf.setFontSize(14);
        pdf.text('Nenhum dado disponível para o período selecionado', 20, 60);
      }

      // Footer  
      pdf.setFontSize(10);
      pdf.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`,
        20,
        pdf.internal.pageSize.height - 20
      );
      
      // Salvar arquivo
      const fileName = `relatorio-gestao-${month}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Erro ao gerar relatório de gestão:', error);
      throw error;
    }
  }
}

export const pdfGenerator = new PDFGenerator();
