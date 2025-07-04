
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface MaintenanceRecord {
  id: string;
  truckName: string;
  maintenanceType: string;
  description: string;
  scheduledDate: string;
  completedDate?: string;
  cost?: number;
  status: string;
}

interface ReportData {
  totalRoutes: number;
  activeRoutes: number;
  totalTrucks: number;
  activeTrucks: number;
  totalKm: number;
  completedTrips: number;
  pendingTrips: number;
}

export class PDFGenerator {
  static generateMaintenanceReport(maintenanceRecords: MaintenanceRecord[], month: string) {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Relatório de Manutenções', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Período: ${month}`, 20, 35);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 45);
    
    // Filter records by month if needed
    const filteredRecords = maintenanceRecords.filter(record => {
      if (!month || month === 'all') return true;
      const recordDate = new Date(record.scheduledDate);
      const [year, monthNum] = month.split('-');
      return recordDate.getFullYear() === parseInt(year) && 
             recordDate.getMonth() === parseInt(monthNum) - 1;
    });
    
    // Statistics
    const stats = {
      total: filteredRecords.length,
      scheduled: filteredRecords.filter(r => r.status === 'scheduled').length,
      inProgress: filteredRecords.filter(r => r.status === 'in-progress').length,
      completed: filteredRecords.filter(r => r.status === 'completed').length,
      totalCost: filteredRecords.reduce((sum, r) => sum + (r.cost || 0), 0)
    };
    
    doc.setFontSize(14);
    doc.text('Resumo:', 20, 65);
    doc.setFontSize(10);
    doc.text(`Total de Manutenções: ${stats.total}`, 25, 75);
    doc.text(`Agendadas: ${stats.scheduled}`, 25, 85);
    doc.text(`Em Andamento: ${stats.inProgress}`, 25, 95);
    doc.text(`Concluídas: ${stats.completed}`, 25, 105);
    doc.text(`Custo Total: R$ ${stats.totalCost.toLocaleString('pt-BR')}`, 25, 115);
    
    // Table
    if (filteredRecords.length > 0) {
      const tableData = filteredRecords.map(record => [
        record.truckName,
        record.maintenanceType,
        new Date(record.scheduledDate).toLocaleDateString('pt-BR'),
        record.status === 'scheduled' ? 'Agendada' :
        record.status === 'in-progress' ? 'Em Andamento' :
        record.status === 'completed' ? 'Concluída' : 'Cancelada',
        `R$ ${(record.cost || 0).toLocaleString('pt-BR')}`
      ]);
      
      (doc as any).autoTable({
        head: [['Caminhão', 'Tipo', 'Data Agendada', 'Status', 'Custo']],
        body: tableData,
        startY: 130,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });
    }
    
    // Save
    doc.save(`relatorio-manutencoes-${month || 'todos'}.pdf`);
  }
  
  static generateSystemReport(reportData: ReportData, monthlyData: any[], month: string) {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Relatório do Sistema', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Período: ${month}`, 20, 35);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 45);
    
    // System Statistics
    doc.setFontSize(14);
    doc.text('Estatísticas Gerais:', 20, 65);
    doc.setFontSize(10);
    doc.text(`Total de Rotas: ${reportData.totalRoutes}`, 25, 75);
    doc.text(`Rotas Ativas: ${reportData.activeRoutes}`, 25, 85);
    doc.text(`Total de Caminhões: ${reportData.totalTrucks}`, 25, 95);
    doc.text(`Caminhões Ativos: ${reportData.activeTrucks}`, 25, 105);
    doc.text(`Viagens Concluídas: ${reportData.completedTrips}`, 25, 115);
    doc.text(`Viagens Pendentes: ${reportData.pendingTrips}`, 25, 125);
    doc.text(`Total de KM: ${reportData.totalKm.toLocaleString('pt-BR')} km`, 25, 135);
    
    // Monthly performance table
    if (monthlyData && monthlyData.length > 0) {
      doc.setFontSize(14);
      doc.text('Performance Mensal:', 20, 160);
      
      const tableData = monthlyData.map(data => [
        data.month,
        data.trips?.toString() || '0',
        `${(data.km || 0).toLocaleString('pt-BR')} km`
      ]);
      
      (doc as any).autoTable({
        head: [['Mês', 'Viagens', 'Quilometragem']],
        body: tableData,
        startY: 170,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] }
      });
    }
    
    // Save
    doc.save(`relatorio-sistema-${month || 'todos'}.pdf`);
  }
}
