import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, MapPin, Camera, Clock, User, Truck, CheckCircle2 } from 'lucide-react';
import { API_CONFIG } from '@/services/config';

interface CompletedRoute {
  id: string;
  route_id: string;
  route_name: string;
  truck_plate?: string;
  driver_name?: string;
  started_at?: string;
  finished_at?: string;
  total_distance?: number;
  total_duration?: number;
  points_snapshot: any[];
  photos_count: number;
  status: string;
}

interface Photo {
  id: string;
  point_id: string;
  file_url: string;
  operation_type?: string;
  uploaded_at: string;
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('pt-BR') : '—';

const CompletedRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<CompletedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(CompletedRoute & { photos: Photo[] }) | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`${API_CONFIG.BASE_URL}/completed-routes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setRoutes(await r.json());
    } finally { setLoading(false); }
  };

  const openDetails = async (id: string) => {
    const token = localStorage.getItem('auth_token');
    const r = await fetch(`${API_CONFIG.BASE_URL}/completed-routes/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setSelected(await r.json());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Rotas Concluídas</h1>
            <p className="text-muted-foreground">Histórico de execuções com fotos e linha do tempo</p>
          </div>
          <Button onClick={load} variant="outline">Atualizar</Button>
        </div>

        {loading ? <p>Carregando...</p> : routes.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma rota registrada ainda.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map(r => {
              const completedPts = (r.points_snapshot || []).filter((p: any) => p.completed).length;
              const totalPts = (r.points_snapshot || []).length;
              return (
                <Card key={r.id} className="cursor-pointer hover:shadow-lg transition" onClick={() => openDetails(r.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg truncate">{r.route_name}</h3>
                      <Badge variant={r.status === 'finished' ? 'default' : 'secondary'}>
                        {r.status === 'finished' ? 'Finalizada' : 'Em andamento'}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <div className="flex items-center gap-2"><Truck className="h-4 w-4" />{r.truck_plate || '—'}</div>
                      <div className="flex items-center gap-2"><User className="h-4 w-4" />{r.driver_name || '—'}</div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4" />Início: {fmtDate(r.started_at)}</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Fim: {fmtDate(r.finished_at)}</div>
                    </div>
                    <div className="flex gap-3 pt-2 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{completedPts}/{totalPts}</span>
                      <span className="flex items-center gap-1"><Camera className="h-3 w-3" />{r.photos_count} fotos</span>
                      {r.total_distance && <span>{Number(r.total_distance).toFixed(1)} km</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.route_name}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div><strong>Motorista:</strong> {selected.driver_name || '—'}</div>
                  <div><strong>Caminhão:</strong> {selected.truck_plate || '—'}</div>
                  <div><strong>Início:</strong> {fmtDate(selected.started_at)}</div>
                  <div><strong>Fim:</strong> {fmtDate(selected.finished_at)}</div>
                  <div><strong>Distância:</strong> {selected.total_distance ? Number(selected.total_distance).toFixed(1) + ' km' : '—'}</div>
                  <div><strong>Fotos:</strong> {selected.photos_count}</div>
                </div>
                <Button asChild className="mb-4">
                  <a href={`${API_CONFIG.BASE_URL}/completed-routes/${selected.id}/photos.zip?token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}`} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4 mr-2" />Baixar todas as fotos (ZIP)
                  </a>
                </Button>
                <h3 className="font-semibold mb-2">Linha do tempo dos pontos</h3>
                <div className="space-y-3">
                  {(selected.points_snapshot || []).map((p: any, i: number) => {
                    const photos = (selected.photos || []).filter(ph => ph.point_id === p.id);
                    return (
                      <Card key={p.id || i}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{i + 1}. {p.customer_name || p.address}</div>
                              <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                              <div className="text-xs flex gap-2 mt-1">
                                {p.point_category && <Badge variant="outline">{p.point_category}</Badge>}
                                {p.operation_type && <Badge variant="outline">{p.operation_type}</Badge>}
                                {p.completed && <Badge className="bg-green-600">Concluído {p.completed_at ? new Date(p.completed_at).toLocaleString('pt-BR') : ''}</Badge>}
                              </div>
                            </div>
                          </div>
                          {photos.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-3">
                              {photos.map(ph => (
                                <a key={ph.id} href={`${API_CONFIG.BASE_URL.replace('/api','')}${ph.file_url}`} target="_blank" rel="noreferrer">
                                  <img src={`${API_CONFIG.BASE_URL.replace('/api','')}${ph.file_url}`} alt="" className="w-full h-24 object-cover rounded border" />
                                </a>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CompletedRoutes;
