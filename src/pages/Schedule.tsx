
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Truck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const Schedule = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const schedules = [
    {
      id: 1,
      truck: 'Caminhão 001',
      route: 'SP → RJ',
      time: '08:00',
      status: 'scheduled',
      driver: 'João Silva'
    },
    {
      id: 2,
      truck: 'Caminhão 002',
      route: 'SP → MG',
      time: '10:30',
      status: 'in-progress',
      driver: 'Maria Santos'
    },
    {
      id: 3,
      truck: 'Caminhão 003',
      route: 'SP → PR',
      time: '14:00',
      status: 'completed',
      driver: 'Pedro Costa'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'in-progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'in-progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      default: return 'Indefinido';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Agenda de Viagens" 
        subtitle="Programação e status das viagens"
      >
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
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
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <Clock className="h-5 w-5 text-gray-500 mb-1" />
                          <span className="text-sm font-medium">{schedule.time}</span>
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
                        </div>
                      </div>
                      
                      <Badge className={getStatusColor(schedule.status)}>
                        {getStatusText(schedule.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
