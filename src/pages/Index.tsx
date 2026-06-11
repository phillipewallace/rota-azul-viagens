
import React, { useEffect, useState } from 'react';
import { Menu, MapPin, Route, Truck, Settings, Users, ClipboardCheck, Container, FileText, ClipboardList, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Map from '@/components/Map';
import TrackingPanel from '@/components/TrackingPanel';
import LinkRouteModal from '@/components/LinkRouteModal';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileOperatorIndex from '@/components/mobile/operator/MobileOperatorIndex';
import { serviceOrdersService } from '@/services/quotes';
import { toast } from 'sonner';

const Index = () => {
  const isMobile = useIsMobile();
  const [isLinkRouteOpen, setIsLinkRouteOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (isMobile) return;
    let mounted = true;
    const check = async () => {
      try {
        const r = await serviceOrdersService.overdueCount();
        if (!mounted) return;
        if (r.overdue > 0 && r.overdue !== overdueCount) {
          toast.warning(`${r.overdue} diária(s) em atraso para recolhimento`, {
            duration: 8000,
            action: { label: 'Ver OS', onClick: () => { window.location.href = '/erp/ordens-servico'; } },
          });
        }
        setOverdueCount(r.overdue);
      } catch {}
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Render mobile version for operator
  if (isMobile) {
    return <MobileOperatorIndex />;
  }

  const menuItems = [
    { icon: Truck, label: 'Vincular Rota ao Caminhão', action: () => setIsLinkRouteOpen(true) },
  ];

  const navigationItems = [
    { icon: MapPin, label: 'Mapa Principal', to: '/' },
    { icon: Route, label: 'Rotas', to: '/routes' },
    { icon: Route, label: 'Rotas Concluídas', to: '/rotas-concluidas' },
    { icon: Settings, label: 'Sanitários', to: '/sanitarios' },
    { icon: Truck, label: 'Caminhões', to: '/trucks' },
    { icon: Container, label: 'Carretinhas', to: '/carretinhas' },
    { icon: ClipboardCheck, label: 'Checklists', to: '/checklists' },
    { icon: Users, label: 'Clientes', to: '/customers' },
    { icon: FileText, label: 'Orçamentos', to: '/erp/orcamentos' },
    { icon: ClipboardList, label: 'Ordens de Serviço', to: '/erp/ordens-servico' },
    { icon: Settings, label: 'Gerenciamento', to: '/management' },
    { icon: Users, label: 'Motoristas', to: '/drivers' },
    { icon: Settings, label: 'Configurações', to: '/settings' },
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
        <SheetContent side="left" className="w-80 max-w-[85vw] p-0">
          <div className="flex flex-col h-full bg-gray-900 text-white">
            <div className="p-4 sm:p-6 border-b border-gray-700">
              <h2 className="text-lg sm:text-xl font-bold text-blue-400">AlchemyRotas</h2>
              <p className="text-xs sm:text-sm text-gray-400">Sistema de Roteirização</p>
            </div>
            
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              <div className="space-y-2">
                {menuItems.map((item, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-left text-white hover:bg-gray-800 hover:text-blue-400 text-sm"
                    onClick={item.action}
                  >
                    <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Button>
                ))}
              </div>
              
              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-700">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 mb-3">NAVEGAÇÃO</h3>
                <div className="space-y-2">
                  {navigationItems.map((item, index) => (
                    <Button key={index} variant="ghost" className="w-full justify-start text-white hover:bg-gray-800 text-sm" asChild>
                      <Link to={item.to}>
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.to === '/erp/ordens-servico' && overdueCount > 0 && (
                          <Badge className="bg-red-600 text-white text-[10px] h-5 gap-1 ml-auto">
                            <AlertTriangle className="h-3 w-3" />{overdueCount}
                          </Badge>
                        )}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 relative w-full">
        <Map />
        <TrackingPanel />
      </div>

      {/* Modals */}
      <LinkRouteModal open={isLinkRouteOpen} onOpenChange={setIsLinkRouteOpen} />
    </div>
  );
};

export default Index;
