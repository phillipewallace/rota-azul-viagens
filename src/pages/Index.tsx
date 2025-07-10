
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Route, Calendar, Users, MapPin, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

const Index = () => {
  const { trucks, loading: trucksLoading } = useTrucks();
  const { routes, loading: routesLoading } = useRoutes();

  const activeTrucks = trucks?.filter(truck => truck.status === 'in-route') || [];
  const availableTrucks = trucks?.filter(truck => truck.status === 'available') || [];
  const activeRoutes = routes?.filter(route => route.status === 'active') || [];

  const stats = [
    {
      title: "Caminhões Ativos",
      value: activeTrucks.length,
      total: trucks?.length || 0,
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/trucks"
    },
    {
      title: "Rotas Ativas", 
      value: activeRoutes.length,
      total: routes?.length || 0,
      icon: Route,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/routes"
    },
    {
      title: "Caminhões Disponíveis",
      value: availableTrucks.length,
      total: trucks?.length || 0,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      link: "/trucks"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de gerenciamento de frota
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} to={stat.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-md ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  de {stat.total} total
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Caminhões em Rota
            </CardTitle>
            <CardDescription>
              Status atual dos caminhões ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trucksLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : activeTrucks.length > 0 ? (
              <div className="space-y-3">
                {activeTrucks.slice(0, 5).map((truck) => (
                  <div key={truck.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{truck.name}</p>
                      <p className="text-sm text-muted-foreground">{truck.plate}</p>
                    </div>
                    <Badge variant="default">Em Rota</Badge>
                  </div>
                ))}
                {activeTrucks.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{activeTrucks.length - 5} mais caminhões
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum caminhão em rota no momento
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Rotas Ativas
            </CardTitle>
            <CardDescription>
              Rotas em execução no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {routesLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ) : activeRoutes.length > 0 ? (
              <div className="space-y-3">
                {activeRoutes.slice(0, 5).map((route) => (
                  <div key={route.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{route.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {route.points?.length || 0} pontos
                      </p>
                    </div>
                    <Badge variant="outline">Ativa</Badge>
                  </div>
                ))}
                {activeRoutes.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{activeRoutes.length - 5} mais rotas
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma rota ativa no momento
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start">
              <Link to="/routes">
                <Route className="mr-2 h-4 w-4" />
                Nova Rota
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/trucks">
                <Truck className="mr-2 h-4 w-4" />
                Gerenciar Caminhões
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link to="/schedule">
                <Calendar className="mr-2 h-4 w-4" />
                Agendamentos
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estatísticas Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 border rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {trucks?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total de Caminhões</p>
              </div>
              <div className="p-4 border rounded">
                <div className="text-2xl font-bold text-green-600">
                  {routes?.length || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total de Rotas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
