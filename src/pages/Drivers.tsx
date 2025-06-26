
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Phone, Mail, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const Drivers = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const drivers = [
    {
      id: 1,
      name: 'João Silva',
      phone: '(11) 99999-9999',
      email: 'joao@example.com',
      license: 'CNH123456',
      status: 'available',
      currentRoute: null,
      totalTrips: 45
    },
    {
      id: 2,
      name: 'Maria Santos',
      phone: '(11) 88888-8888',
      email: 'maria@example.com',
      license: 'CNH234567',
      status: 'on-route',
      currentRoute: 'SP → MG',
      totalTrips: 67
    },
    {
      id: 3,
      name: 'Pedro Costa',
      phone: '(11) 77777-7777',
      email: 'pedro@example.com',
      license: 'CNH345678',
      status: 'available',
      currentRoute: null,
      totalTrips: 23
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'on-route': return 'bg-blue-500';
      case 'off-duty': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'on-route': return 'Em Rota';
      case 'off-duty': return 'Folga';
      default: return 'Indefinido';
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <PageHeader 
        title="Motoristas" 
        subtitle="Gerenciamento da equipe de motoristas"
      >
        <Button>
          Cadastrar Motorista
        </Button>
      </PageHeader>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar motoristas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{driver.name}</CardTitle>
                  <Badge className={getStatusColor(driver.status)}>
                    {getStatusText(driver.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{driver.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{driver.email}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">CNH:</span> {driver.license}
                  </div>
                  {driver.currentRoute && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span>Rota atual: {driver.currentRoute}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    Total de viagens: {driver.totalTrips}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Contato
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Drivers;
