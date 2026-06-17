
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaintenanceRecord, FileAttachment } from '@/hooks/useMaintenanceManagement';
import { FileUpload } from './FileUpload';

interface MaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecord?: MaintenanceRecord | null;
  onSave: (record: any) => void;
  trucks: Array<{ id: string; name: string; plate: string }>;
  loading: boolean;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  open,
  onOpenChange,
  editingRecord,
  onSave,
  trucks,
  loading
}) => {
  const [formData, setFormData] = useState({
    truck_id: '',
    maintenance_type: '',
    description: '',
    scheduled_date: '',
    cost: '',
    mileage: '',
    status: 'scheduled'
  });

  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);

  const maintenanceTypes = [
    { value: 'preventiva', label: 'Preventiva' },
    { value: 'corretiva', label: 'Corretiva' },
    { value: 'preditiva', label: 'Preditiva' },
    { value: 'revisao', label: 'Revisão' },
    { value: 'inspecao', label: 'Inspeção' }
  ];

  const statusOptions = [
    { value: 'scheduled', label: 'Agendada' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'completed', label: 'Concluída' }
  ];

  useEffect(() => {
    if (editingRecord) {
      setFormData({
        truck_id: editingRecord.truck_id,
        maintenance_type: editingRecord.maintenance_type,
        description: editingRecord.description,
        scheduled_date: editingRecord.scheduled_date ? editingRecord.scheduled_date.split('T')[0] : '',
        cost: editingRecord.cost.toString(),
        mileage: editingRecord.mileage != null ? String(editingRecord.mileage) : '',
        status: editingRecord.status
      });
      setAttachedFiles(editingRecord.files || []);
    } else {
      setFormData({
        truck_id: '',
        maintenance_type: '',
        description: '',
        scheduled_date: '',
        cost: '',
        mileage: '',
        status: 'scheduled'
      });
      setAttachedFiles([]);
    }
  }, [editingRecord, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      cost: parseFloat(formData.cost) || 0,
      mileage: formData.mileage === '' ? null : parseInt(formData.mileage),
      files: attachedFiles
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      truck_id: '',
      maintenance_type: '',
      description: '',
      scheduled_date: '',
      cost: '',
      mileage: '',
      status: 'scheduled'
    });
    setAttachedFiles([]);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? 'Editar Manutenção' : 'Nova Manutenção'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="truck">Caminhão *</Label>
            <Select 
              value={formData.truck_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, truck_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um caminhão" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    {truck.name} - {truck.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Manutenção *</Label>
            <Select 
              value={formData.maintenance_type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, maintenance_type: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {maintenanceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva os detalhes da manutenção..."
              required
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data Agendada *</Label>
              <Input
                id="date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Custo (R$)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage">Quilometragem no momento (km)</Label>
            <Input
              id="mileage"
              type="number"
              min="0"
              step="1"
              value={formData.mileage}
              onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
              placeholder="Ex.: 125000"
            />
            <p className="text-xs text-muted-foreground">
              Km do veículo na hora em que a manutenção foi realizada.
            </p>
          </div>


          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Documentos Anexos</Label>
            <FileUpload
              files={attachedFiles}
              onFilesChange={setAttachedFiles}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
