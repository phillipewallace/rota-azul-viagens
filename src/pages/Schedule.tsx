import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, Truck, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { useSchedule } from '@/hooks/useSchedule';
import { useScheduleCRUD } from '@/hooks/useScheduleCRUD';
import { ScheduleForm } from '@/components/ScheduleForm';
import { Schedule as ScheduleType } from '@/hooks/useSchedule';

const Schedule = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleType | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const { schedules, loading, refetch } = useSchedule();
  const { createSchedule, updateSchedule, deleteSchedule, isLoading: scheduleCrudLoading } = useScheduleCRUD();

  const handleCreateSchedule = async (data: Omit<ScheduleType, 'id'>) => {
    try {
      await createSchedule(data);
      setShowScheduleForm(false);
      refetch();
      toast({ title: 'Agendamento criado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao criar agendamento', variant: 'destructive' });
    }
  };

  const handleUpdateSchedule = async (data: Omit<ScheduleType, 'id'>) => {
    if (!editingSchedule) return;
    try {
      await updateSchedule({ id: editingSchedule.id, schedule: data });
      setEditingSchedule(null);
      refetch();
      toast({ title: 'Agendamento atualizado com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar agendamento', variant: 'destructive' });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
      try {
        await deleteSchedule(id);
        refetch();
        toast({ title: 'Agendamento excluído com sucesso!' });
      } catch (error) {
        toast({ title: 'Erro ao excluir agendamento', variant: 'destructive' });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'in-progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'in-progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return 'Indefinido';
    }
  };

  const filteredSchedules = schedules.filter(schedule =>
    schedule.scheduledDate === selectedDate
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Agenda de Viagens" 
        subtitle="Programação e status das viagens"
      >
        <Button onClick={() => setShowScheduleForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Programação
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
                <div className="mt-4 text-sm text-gray-600">
                  Agendamentos: {filteredSchedules.length}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {loading ? (
              <div className="text-center py-8">Carregando agendamentos...</div>
            ) : (
              <div className="space-y-4">
                {filteredSchedules.map((schedule) => (
                  <Card key={schedule.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                            <Clock className="h-5 w-5 text-gray-500 mb-1" />
                            <span className="text-sm font-medium">{schedule.scheduledTime}</span>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-blue-500" />
                              <span className="font-semibold">{schedule.truck}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-500" />
                              <span className="text-gray-600">{schedule.route}</span>
                            </div>
                            <div className="text-sm text-gray-500">
                              Motorista: {schedule.driver}
                            </div>
                            {schedule.notes && (
                              <div className="text-sm text-gray-500">
                                Obs: {schedule.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(schedule.status)}>
                            {getStatusText(schedule.status)}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingSchedule(schedule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSchedule(schedule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredSchedules.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum agendamento para esta data</p>
                      <Button 
                        className="mt-4" 
                        onClick={() => setShowScheduleForm(true)}
                      >
                        Criar Agendamento
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Form Dialog */}
      <Dialog open={showScheduleForm || !!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          setShowScheduleForm(false);
          setEditingSchedule(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <ScheduleForm
            schedule={editingSchedule || undefined}
            onSubmit={editingSchedule ? handleUpdateSchedule : handleCreateSchedule}
            onCancel={() => {
              setShowScheduleForm(false);
              setEditingSchedule(null);
            }}
            isLoading={scheduleCrudLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
