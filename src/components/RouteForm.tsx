import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { TextField, Button, Box, Typography, Autocomplete, IconButton, Stack, Divider, InputAdornment } from '@mui/material';
import { Add, Delete, LocationOn } from '@mui/icons-material';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRoutes, RoutePoint, Route } from '@/hooks/useRoutes';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Define o schema de validação com Yup
const routeSchema = yup.object({
  name: yup.string().required('O nome da rota é obrigatório'),
  description: yup.string(),
  points: yup.array().of(
    yup.object().shape({
      address: yup.string().required('O endereço é obrigatório'),
      cep: yup.string(),
      lat: yup.number().required('A latitude é obrigatória'),
      lng: yup.number().required('A longitude é obrigatória'),
      order: yup.number(),
      type: yup.string().oneOf(['origin', 'destination', 'waypoint']),
      completed: yup.boolean(),
      completedAt: yup.string().nullable(),
    })
  ).min(2, 'É necessário pelo menos 2 pontos na rota'),
  totalDistance: yup.number(),
  estimatedTime: yup.string(),
  optimizedOrder: yup.array().of(yup.string()),
}).required();

// Define a interface para as propriedades do componente
interface RouteFormProps {
  onSubmit: () => void;
  editingRoute?: Route;
  onCancel?: () => void;
}

// Componente funcional RouteForm
const RouteForm = ({ onSubmit, editingRoute, onCancel }: RouteFormProps) => {
  const { optimizeRoute, getAddressByCep } = useRoutes();
  const [points, setPoints] = useState<RoutePoint[]>(editingRoute?.points || []);
  const [totalDistance, setTotalDistance] = useState<number>(editingRoute?.totalDistance || 0);
  const [estimatedTime, setEstimatedTime] = useState<string>(editingRoute?.estimatedTime || '');
  const [optimizedOrder, setOptimizedOrder] = useState<string[]>(editingRoute?.optimizedOrder || []);
  const [polyline, setPolyline] = useState<string>(editingRoute?.polyline || '');
  const [optimizing, setOptimizing] = useState(false);

  // Inicializa o formulário com react-hook-form
  const { register, handleSubmit, control, setValue, formState: { errors }, reset } = useForm<yup.InferType<typeof routeSchema>>({
    resolver: yupResolver(routeSchema),
    defaultValues: {
      name: editingRoute?.name || '',
      description: editingRoute?.description || '',
      points: editingRoute?.points || [],
      totalDistance: editingRoute?.totalDistance || 0,
      estimatedTime: editingRoute?.estimatedTime || '',
      optimizedOrder: editingRoute?.optimizedOrder || [],
    }
  });

  // Efeito para resetar o formulário quando editingRoute muda
  useEffect(() => {
    if (editingRoute) {
      reset({
        name: editingRoute.name,
        description: editingRoute.description || '',
        points: editingRoute.points,
        totalDistance: editingRoute.totalDistance,
        estimatedTime: editingRoute.estimatedTime,
        optimizedOrder: editingRoute.optimizedOrder,
      });
      setPoints(editingRoute.points);
      setTotalDistance(editingRoute.totalDistance);
      setEstimatedTime(editingRoute.estimatedTime);
      setOptimizedOrder(editingRoute.optimizedOrder);
      setPolyline(editingRoute.polyline || '');
    } else {
      reset({
        name: '',
        description: '',
        points: [],
        totalDistance: 0,
        estimatedTime: '',
        optimizedOrder: [],
      });
      setPoints([]);
      setTotalDistance(0);
      setEstimatedTime('');
      setOptimizedOrder([]);
      setPolyline('');
    }
  }, [editingRoute, reset]);

  // Função para adicionar um novo ponto
  const handleAddPoint = () => {
    const newPoint: RoutePoint = {
      id: `point-${Date.now()}`,
      address: '',
      cep: '',
      lat: 0,
      lng: 0,
      order: points.length,
      type: 'waypoint',
      completed: false,
      completedAt: null,
    };
    setPoints([...points, newPoint]);
  };

  // Função para remover um ponto
  const handleRemovePoint = (index: number) => {
    const newPoints = [...points];
    newPoints.splice(index, 1);
    // Recalcula a ordem dos pontos restantes
    const updatedPoints = newPoints.map((point, i) => ({ ...point, order: i }));
    setPoints(updatedPoints);
  };

  // Função para buscar o endereço pelo CEP
  const handleSearchCep = async (index: number, cep: string) => {
    try {
      const addressData = await getAddressByCep(cep);
      const newPoints = [...points];
      newPoints[index] = {
        ...newPoints[index],
        address: addressData.address,
        lat: addressData.lat,
        lng: addressData.lng,
        cep: cep,
      };
      setPoints(newPoints);
      setValue(`points.${index}.address`, addressData.address);
      setValue(`points.${index}.lat`, addressData.lat);
      setValue(`points.${index}.lng`, addressData.lng);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar endereço');
    }
  };

  // Função para atualizar o valor de um ponto
  const handlePointChange = (index: number, field: string, value: any) => {
    const newPoints = [...points];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setPoints(newPoints);
  };

  const handleOptimize = async () => {
    try {
      setOptimizing(true);
      
      if (points.length < 2) {
        toast.error('É necessário pelo menos 2 pontos para otimizar a rota');
        return;
      }

      console.log('🎯 [ROUTE FORM] Iniciando otimização com prioridade inteligente');
      
      // ✅ USAR SISTEMA PRIORIZADO (inteligente primeiro, tradicional como fallback)
      const result = await optimizeRoute(points, editingRoute?.id);
      
      console.log('✅ [ROUTE FORM] Otimização concluída:', result);
      
      setPoints(result.points);
      setTotalDistance(result.totalDistance);
      setEstimatedTime(result.estimatedTime);
      setOptimizedOrder(result.optimizedOrder);
      setPolyline(result.polyline);
      
      // ✅ LOG DETALHADO DO RESULTADO
      const completedCount = result.points.filter((p: RoutePoint) => p.completed).length;
      const pendingCount = result.points.filter((p: RoutePoint) => !p.completed).length;
      
      if (completedCount > 0) {
        toast.success(`Rota otimizada preservando ${completedCount} pontos concluídos`);
        console.log(`🛡️ [ROUTE FORM] ${completedCount} pontos preservados, ${pendingCount} otimizados`);
      } else {
        toast.success('Rota otimizada com sucesso');
        console.log(`🆓 [ROUTE FORM] ${result.points.length} pontos otimizados (rota livre)`);
      }
      
    } catch (error) {
      console.error('❌ [ROUTE FORM] Erro na otimização:', error);
      toast.error('Erro ao otimizar rota');
    } finally {
      setOptimizing(false);
    }
  };

  // Função para lidar com o envio do formulário
  const onSubmitData = (data: yup.InferType<typeof routeSchema>) => {
    const routeData = {
      ...data,
      points: points,
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      optimizedOrder: optimizedOrder,
      polyline: polyline,
    };
    console.log('Dados da rota a serem enviados:', routeData);
    onSubmit();
  };

  const mapCenter = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [-23.5505, -46.6333]; // Posição padrão: São Paulo

  const polylinePositions = points.map(point => [point.lat, point.lng]);

  // Custom icon
  const customIcon = new L.Icon({
    iconUrl: '/images/marker-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: null,
    shadowSize: null,
    shadowAnchor: null
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmitData)} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6">{editingRoute ? 'Editar Rota' : 'Criar Nova Rota'}</Typography>

      <TextField
        label="Nome da Rota"
        {...register("name")}
        error={!!errors.name}
        helperText={errors.name?.message}
        fullWidth
        margin="normal"
      />

      <TextField
        label="Descrição da Rota"
        {...register("description")}
        fullWidth
        margin="normal"
        multiline
        rows={2}
      />

      <Typography variant="subtitle1">Pontos da Rota</Typography>
      {points.map((point, index) => (
        <Box key={point.id} sx={{ border: '1px solid #ccc', borderRadius: '4px', padding: 2, mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="subtitle2">Ponto {index + 1}</Typography>
            <IconButton onClick={() => handleRemovePoint(index)} aria-label="Remover Ponto">
              <Delete />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={2} mb={2}>
            <TextField
              label="CEP"
              value={point.cep || ''}
              onChange={(e) => {
                handlePointChange(index, 'cep', e.target.value);
              }}
              onBlur={(e) => handleSearchCep(index, e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => handleSearchCep(index, point.cep || '')}>
                      <LocationOn />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              size="small"
            />
            <TextField
              label="Endereço"
              value={point.address}
              onChange={(e) => {
                handlePointChange(index, 'address', e.target.value);
                setValue(`points.${index}.address`, e.target.value);
              }}
              size="small"
              error={!!errors.points?.[index]?.address}
              helperText={errors.points?.[index]?.address?.message}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude"
              value={point.lat}
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                handlePointChange(index, 'lat', lat);
                setValue(`points.${index}.lat`, lat);
              }}
              type="number"
              size="small"
              error={!!errors.points?.[index]?.lat}
              helperText={errors.points?.[index]?.lat?.message}
            />
            <TextField
              label="Longitude"
              value={point.lng}
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                handlePointChange(index, 'lng', lng);
                setValue(`points.${index}.lng`, lng);
              }}
              type="number"
              size="small"
              error={!!errors.points?.[index]?.lng}
              helperText={errors.points?.[index]?.lng?.message}
            />
          </Stack>
        </Box>
      ))}

      <Button startIcon={<Add />} variant="outlined" onClick={handleAddPoint}>
        Adicionar Ponto
      </Button>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Mapa da Rota</Typography>
        <Button variant="contained" onClick={handleOptimize} disabled={optimizing}>
          {optimizing ? 'Otimizando...' : 'Otimizar Rota'}
        </Button>
      </Stack>

      <Box sx={{ height: '400px', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {points.map((point, index) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={customIcon}
            >
              <Popup>
                {point.address}
              </Popup>
            </Marker>
          ))}
          {polylinePositions.length > 1 && (
            <Polyline positions={polylinePositions} color="blue" />
          )}
        </MapContainer>
      </Box>

      <Stack direction="row" justifyContent="space-between">
        {onCancel && (
          <Button onClick={onCancel}>Cancelar</Button>
        )}
        <Button type="submit" variant="contained">
          {editingRoute ? 'Salvar Alterações' : 'Criar Rota'}
        </Button>
      </Stack>
    </Box>
  );
};

export default RouteForm;
