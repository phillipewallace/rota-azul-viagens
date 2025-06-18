
import React, { useState } from 'react';
import { Menu, MapPin, Route, Truck, Wrench, Calendar, BarChart3, Settings, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Map from '@/components/Map';
import TrackingPanel from '@/components/TrackingPanel';
import CreateRouteModal from '@/components/CreateRouteModal';
import LinkRouteModal from '@/components/LinkRouteModal';
import MaintenanceModal from '@/components/MaintenanceModal';

const Index = () => {
  const [isCreateRouteOpen, setIsCreateRouteOpen] = useState(false);
  const [isLinkRouteOpen, setIsLinkRouteOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const menuItems = [
    { icon: Route, label: 'Criar Rota', action: () => setIsCreateRouteOpen(true) },
    { icon: Truck, label: 'Vincular Rota ao Caminhão', action: () => setIsLinkRouteOpen(true) },
    { icon: Wrench, label: 'Gerenciar Manutenção', action: () => setIsMaintenanceOpen(true) },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button 
            size="icon" 
            className="fixed top-4 left-4 z-20 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex flex-col h-full bg-gray-900 text-white">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-blue-400">Rota Azul Viagens</h2>
              <p className="text-sm text-gray-400">Sistema de Roteirização</p>
            </div>
            
            <div className="flex-1 p-4">
              <div className="space-y-2">
                {menuItems.map((item, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-left text-white hover:bg-gray-800 hover:text-blue-400"
                    onClick={item.action}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">NAVEGAÇÃO</h3>
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
                    <MapPin className="mr-3 h-4 w-4" />
                    Mapa Principal
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
                    <BarChart3 className="mr-3 h-4 w-4" />
                    Relatórios
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
                    <Calendar className="mr-3 h-4 w-4" />
                    Agenda
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
                    <Users className="mr-3 h-4 w-4" />
                    Motoristas
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
                    <Settings className="mr-3 h-4 w-4" />
                    Configurações
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 relative">
        <Map />
        <TrackingPanel />
      </div>

      {/* Modals */}
      <CreateRouteModal open={isCreateRouteOpen} onOpenChange={setIsCreateRouteOpen} />
      <LinkRouteModal open={isLinkRouteOpen} onOpenChange={setIsLinkRouteOpen} />
      <MaintenanceModal open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen} />
    </div>
  );
};

export default Index;
