interface OptimizationPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

interface OptimizationResult {
  optimizedPoints: OptimizationPoint[];
  totalDistance: number;
  totalDuration: number;
  polyline: string;
  optimizedOrder: string[];
}

class GoogleMapsOptimizer {
  private apiKey = 'AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w';
  private readonly ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  private readonly MAX_WAYPOINTS = 23; // ✅ REDUZIDO para permitir melhor clustering
  private readonly MAX_CLUSTER_SIZE = 20; // ✅ NOVO: Tamanho máximo do cluster

  async optimizeRouteWithGoogleAPIs(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER V2] Otimizando ${points.length} pontos com estratégia híbrida`);
    
    if (points.length < 2) {
      throw new Error('Necessário pelo menos 2 pontos para otimizar');
    }

    // Para rotas simples (2 pontos)
    if (points.length === 2) {
      return await this.optimizeTwoPointRoute(points);
    }

    // ✅ NOVA ESTRATÉGIA: Rotas grandes usam clustering geográfico
    if (points.length > this.MAX_WAYPOINTS + 2) {
      console.log(`🌍 [OPTIMIZER V2] Rota grande (${points.length} pontos) - usando clustering geográfico`);
      return await this.optimizeWithGeographicClustering(points);
    }

    // Para rotas normais, usar Routes API v2 diretamente
    return await this.optimizeWithRoutesAPIv2(points);
  }

  // ✅ NOVA IMPLEMENTAÇÃO: Clustering geográfico para rotas grandes
  private async optimizeWithGeographicClustering(points: OptimizationPoint[]): Promise<OptimizationResult> {
    try {
      console.log(`🧮 [CLUSTERING] Iniciando clustering geográfico para ${points.length} pontos`);
      
      const origin = points.find(p => p.type === 'origin') || points[0];
      const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
      const waypoints = points.filter(p => 
        p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
      );

      console.log(`📍 [CLUSTERING] Origem: ${origin.address}`);
      console.log(`🎯 [CLUSTERING] Destino: ${destination.address}`);
      console.log(`⚡ [CLUSTERING] Waypoints para agrupar: ${waypoints.length}`);

      // ✅ IMPLEMENTAÇÃO: Algoritmo de clustering por proximidade geográfica
      const clusters = await this.createGeographicClusters(waypoints, this.MAX_CLUSTER_SIZE);
      
      console.log(`📊 [CLUSTERING] Criados ${clusters.length} clusters`);
      clusters.forEach((cluster, index) => {
        console.log(`   Cluster ${index + 1}: ${cluster.length} pontos`);
      });

      // ✅ OTIMIZAÇÃO: Otimizar cada cluster individualmente
      const optimizedClusters = await this.optimizeClusters(clusters, origin, destination);

      // ✅ CONEXÃO: Conectar clusters de forma inteligente
      const finalOptimizedPoints = await this.connectOptimizedClusters(optimizedClusters, origin, destination);

      // ✅ MÉTRICAS: Calcular métricas finais
      const totalDistance = this.calculateTotalDistance(finalOptimizedPoints);
      const totalDuration = totalDistance * 60; // Estimativa: 1 min por km
      
      console.log(`✅ [CLUSTERING] Otimização concluída: ${finalOptimizedPoints.length} pontos, ${totalDistance.toFixed(1)}km`);

      return {
        optimizedPoints: finalOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: '', // Polyline será gerada se necessário
        optimizedOrder: finalOptimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [CLUSTERING] Erro na otimização com clustering:', error);
      
      // ✅ FALLBACK: Estratégia linear simples
      return await this.handleLargeRouteLinear(points);
    }
  }

  // ✅ NOVA FUNÇÃO: Criar clusters geográficos
  private async createGeographicClusters(waypoints: OptimizationPoint[], maxClusterSize: number): Promise<OptimizationPoint[][]> {
    if (waypoints.length <= maxClusterSize) {
      return [waypoints];
    }

    const clusters: OptimizationPoint[][] = [];
    const unprocessedPoints = [...waypoints];

    while (unprocessedPoints.length > 0) {
      const cluster: OptimizationPoint[] = [];
      const seedPoint = unprocessedPoints.shift()!;
      cluster.push(seedPoint);

      // ✅ ALGORITMO: Adicionar pontos mais próximos ao cluster
      while (cluster.length < maxClusterSize && unprocessedPoints.length > 0) {
        const lastPoint = cluster[cluster.length - 1];
        let closestIndex = 0;
        let minDistance = this.calculateDistance(lastPoint, unprocessedPoints[0]);

        for (let i = 1; i < unprocessedPoints.length; i++) {
          const distance = this.calculateDistance(lastPoint, unprocessedPoints[i]);
          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
          }
        }

        const closestPoint = unprocessedPoints.splice(closestIndex, 1)[0];
        cluster.push(closestPoint);
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  // ✅ NOVA FUNÇÃO: Otimizar clusters individualmente
  private async optimizeClusters(clusters: OptimizationPoint[][], origin: OptimizationPoint, destination: OptimizationPoint): Promise<OptimizationPoint[][]> {
    const optimizedClusters: OptimizationPoint[][] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      
      console.log(`🎯 [CLUSTER ${i + 1}] Otimizando cluster com ${cluster.length} pontos`);

      try {
        // ✅ CONFIGURAÇÃO: Definir origem e destino do cluster
        const clusterOrigin = i === 0 ? origin : cluster[0];
        const clusterDestination = i === clusters.length - 1 ? destination : cluster[cluster.length - 1];

        // ✅ CRIAR pontos para otimização do cluster
        const clusterPoints = [
          { ...clusterOrigin, type: 'origin' as const },
          ...cluster.slice(1, -1).map(p => ({ ...p, type: 'waypoint' as const })),
          { ...clusterDestination, type: 'destination' as const }
        ];

        if (clusterPoints.length > 2) {
          // ✅ OTIMIZAR cluster usando Routes API v2
          const clusterResult = await this.optimizeWithRoutesAPIv2(clusterPoints);
          optimizedClusters.push(clusterResult.optimizedPoints);
        } else {
          // ✅ CLUSTER muito pequeno - manter ordem original
          optimizedClusters.push(clusterPoints);
        }

        console.log(`✅ [CLUSTER ${i + 1}] Otimizado com sucesso`);

      } catch (error) {
        console.error(`❌ [CLUSTER ${i + 1}] Erro na otimização:`, error);
        
        // ✅ FALLBACK: Manter ordem original do cluster
        optimizedClusters.push(cluster);
      }
    }

    return optimizedClusters;
  }

  // ✅ NOVA FUNÇÃO: Conectar clusters otimizados
  private async connectOptimizedClusters(clusters: OptimizationPoint[][], origin: OptimizationPoint, destination: OptimizationPoint): Promise<OptimizationPoint[]> {
    const connectedPoints: OptimizationPoint[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      
      if (i === 0) {
        // ✅ PRIMEIRO cluster: incluir origem + pontos do cluster
        connectedPoints.push(
          { ...origin, order: 0, type: 'origin' as const },
          ...cluster.slice(1).map((p, index) => ({ ...p, order: index + 1, type: 'waypoint' as const }))
        );
      } else if (i === clusters.length - 1) {
        // ✅ ÚLTIMO cluster: incluir pontos do cluster + destino
        connectedPoints.push(
          ...cluster.slice(0, -1).map((p, index) => ({ ...p, order: connectedPoints.length + index, type: 'waypoint' as const })),
          { ...destination, order: connectedPoints.length + cluster.length - 1, type: 'destination' as const }
        );
      } else {
        // ✅ CLUSTERS intermediários: incluir apenas pontos do cluster
        connectedPoints.push(
          ...cluster.map((p, index) => ({ ...p, order: connectedPoints.length + index, type: 'waypoint' as const }))
        );
      }
    }

    return connectedPoints;
  }

  // ✅ NOVA FUNÇÃO: Fallback linear para rotas grandes
  private async handleLargeRouteLinear(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📏 [LINEAR FALLBACK] Aplicando estratégia linear para ${points.length} pontos`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // ✅ ORDENAÇÃO: Ordenar pontos por proximidade linear
    const orderedPoints = [origin];
    let currentPoint = origin;
    const remainingPoints = [...waypoints];

    while (remainingPoints.length > 0) {
      let closestIndex = 0;
      let minDistance = this.calculateDistance(currentPoint, remainingPoints[0]);

      for (let i = 1; i < remainingPoints.length; i++) {
        const distance = this.calculateDistance(currentPoint, remainingPoints[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      const closestPoint = remainingPoints.splice(closestIndex, 1)[0];
      orderedPoints.push(closestPoint);
      currentPoint = closestPoint;
    }

    orderedPoints.push(destination);

    // ✅ REORDENAR com índices corretos
    const finalPoints = orderedPoints.map((point, index) => ({
      ...point,
      order: index,
      type: index === 0 ? 'origin' as const : 
            index === orderedPoints.length - 1 ? 'destination' as const : 
            'waypoint' as const
    }));

    const totalDistance = this.calculateTotalDistance(finalPoints);
    const totalDuration = totalDistance * 60;

    console.log(`✅ [LINEAR FALLBACK] Concluído: ${finalPoints.length} pontos, ${totalDistance.toFixed(1)}km`);

    return {
      optimizedPoints: finalPoints,
      totalDistance,
      totalDuration,
      polyline: '',
      optimizedOrder: finalPoints.map(p => p.id)
    };
  }

  // ✅ FUNÇÃO AUXILIAR: Calcular distância total
  private calculateTotalDistance(points: OptimizationPoint[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.calculateDistance(points[i], points[i + 1]);
    }
    return total;
  }

  // ✅ FUNÇÃO AUXILIAR: Calcular distância entre dois pontos
  private calculateDistance(point1: OptimizationPoint, point2: OptimizationPoint): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
             Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async optimizeTwoPointRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const [origin, destination] = points;
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      const response = await fetch(this.ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      return {
        optimizedPoints: [
          { ...origin, order: 0, type: 'origin' },
          { ...destination, order: 1, type: 'destination' }
        ],
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: [origin.id, destination.id]
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização 2 pontos:', error);
      throw error;
    }
  }

  private async optimizeWithRoutesAPIv2(points: OptimizationPoint[]): Promise<OptimizationResult> {
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    // ✅ CRÍTICO: Aplicar limite rigoroso de 25 waypoints
    const limitedWaypoints = waypoints.slice(0, this.MAX_WAYPOINTS);
    
    if (waypoints.length > this.MAX_WAYPOINTS) {
      console.log(`⚠️ [OPTIMIZER V2] Limitando waypoints: ${waypoints.length} → ${this.MAX_WAYPOINTS}`);
    }

    console.log(`🚀 [OPTIMIZER V2] Processando ${limitedWaypoints.length} waypoints de ${waypoints.length} totais`);

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng
          }
        }
      },
      intermediates: limitedWaypoints.map(wp => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng
          }
        }
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      optimizeWaypointOrder: true,
      computeAlternativeRoutes: false,
      languageCode: 'pt-BR',
      units: 'METRIC'
    };

    try {
      console.log(`📡 [OPTIMIZER V2] Enviando requisição para Routes API v2 com ${limitedWaypoints.length} waypoints`);
      
      const response = await fetch(this.ROUTES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [OPTIMIZER V2] Routes API error:`, errorText);
        throw new Error(`Routes API v2 error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.routes?.length) {
        throw new Error('Nenhuma rota encontrada');
      }

      const route = data.routes[0];
      let optimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];

      // Reordenar waypoints conforme otimização do Google
      if (route.optimizedIntermediateWaypointIndex && limitedWaypoints.length > 0) {
        console.log(`🔄 [OPTIMIZER V2] Reordenando ${limitedWaypoints.length} waypoints conforme otimização`);
        
        const reorderedWaypoints = route.optimizedIntermediateWaypointIndex
          .map((index: number, newOrder: number) => ({
            ...limitedWaypoints[index],
            order: newOrder + 1,
            type: 'waypoint' as const
          }));
        optimizedPoints.push(...reorderedWaypoints);
      } else {
        optimizedPoints.push(
          ...limitedWaypoints.map((wp, index) => ({
            ...wp,
            order: index + 1,
            type: 'waypoint' as const
          }))
        );
      }

      // ✅ MELHORADO: Adicionar waypoints excedentes que não puderam ser otimizados no final
      if (waypoints.length > this.MAX_WAYPOINTS) {
        const excessWaypoints = waypoints.slice(this.MAX_WAYPOINTS).map((wp, index) => ({
          ...wp,
          order: optimizedPoints.length + index,
          type: 'waypoint' as const
        }));
        optimizedPoints.push(...excessWaypoints);
        
        console.log(`📍 [OPTIMIZER V2] Adicionados ${excessWaypoints.length} waypoints excedentes não otimizados`);
      }

      // Garantir que o destino seja sempre o último
      optimizedPoints.push({
        ...destination,
        order: optimizedPoints.length,
        type: 'destination' as const
      });

      const totalDistance = route.distanceMeters / 1000;
      const totalDuration = parseInt(route.duration?.replace('s', '') || '0');

      console.log(`✅ [OPTIMIZER V2] Otimizada: ${totalDistance.toFixed(1)}km, ${Math.round(totalDuration/60)}min`);
      console.log(`📊 [OPTIMIZER V2] Total de pontos processados: ${optimizedPoints.length}`);

      return {
        optimizedPoints,
        totalDistance,
        totalDuration,
        polyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: optimizedPoints.map(p => p.id)
      };

    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização Routes API v2:', error);
      throw error;
    }
  }

  // ✅ MELHORADO: Implementação para rotas grandes - dividir inteligentemente
  private async handleLargeRoute(points: OptimizationPoint[]): Promise<OptimizationResult> {
    console.log(`📊 [OPTIMIZER V2] Rota grande com ${points.length} pontos - aplicando estratégia de segmentação`);
    
    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => 
      p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id)
    );

    try {
      // ✅ ESTRATÉGIA MELHORADA: Dividir em segmentos otimizáveis
      const segments = [];
      const segmentSize = this.MAX_WAYPOINTS; // 25 waypoints por segmento
      
      // Criar segmentos de waypoints
      for (let i = 0; i < waypoints.length; i += segmentSize) {
        const segmentWaypoints = waypoints.slice(i, i + segmentSize);
        segments.push(segmentWaypoints);
      }

      console.log(`🔧 [OPTIMIZER V2] Dividindo em ${segments.length} segmentos de até ${segmentSize} waypoints`);

      let allOptimizedPoints = [{ ...origin, order: 0, type: 'origin' as const }];
      let totalDistance = 0;
      let totalDuration = 0;
      let finalPolyline = '';

      // Otimizar cada segmento
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;
        
        // Determinar origem e destino do segmento
        const segmentOrigin = i === 0 ? origin : allOptimizedPoints[allOptimizedPoints.length - 1];
        const segmentDestination = isLastSegment ? destination : segment[segment.length - 1];
        
        // Criar lista de pontos para otimizar
        const segmentPoints = [
          { ...segmentOrigin, type: 'origin' as const },
          ...segment.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
          { ...segmentDestination, type: 'destination' as const }
        ];

        console.log(`🎯 [OPTIMIZER V2] Otimizando segmento ${i + 1}/${segments.length} com ${segmentPoints.length} pontos`);

        try {
          const segmentResult = await this.optimizeWithRoutesAPIv2(segmentPoints);
          
          // Adicionar pontos do segmento (exceto o primeiro se não for o primeiro segmento)
          const pointsToAdd = i === 0 ? segmentResult.optimizedPoints : segmentResult.optimizedPoints.slice(1);
          
          pointsToAdd.forEach((point, index) => {
            allOptimizedPoints.push({
              ...point,
              order: allOptimizedPoints.length
            });
          });

          totalDistance += segmentResult.totalDistance;
          totalDuration += segmentResult.totalDuration;
          
          if (segmentResult.polyline) {
            finalPolyline += segmentResult.polyline;
          }

        } catch (segmentError) {
          console.error(`❌ [OPTIMIZER V2] Erro no segmento ${i + 1}:`, segmentError);
          
          // Fallback: adicionar pontos do segmento sem otimização
          const fallbackPoints = segment.map((point, index) => ({
            ...point,
            order: allOptimizedPoints.length + index,
            type: 'waypoint' as const
          }));
          
          allOptimizedPoints.push(...fallbackPoints);
        }
      }

      // Garantir que o destino seja o último
      if (allOptimizedPoints[allOptimizedPoints.length - 1].id !== destination.id) {
        allOptimizedPoints.push({
          ...destination,
          order: allOptimizedPoints.length,
          type: 'destination' as const
        });
      }

      console.log(`✅ [OPTIMIZER V2] Rota grande processada: ${allOptimizedPoints.length} pontos, ${totalDistance.toFixed(1)}km`);

      return {
        optimizedPoints: allOptimizedPoints,
        totalDistance,
        totalDuration,
        polyline: finalPolyline,
        optimizedOrder: allOptimizedPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER V2] Erro na otimização de rota grande:', error);
      
      // Fallback final: retornar pontos na ordem original
      const fallbackPoints = [origin, ...waypoints, destination].map((point, index) => ({
        ...point,
        order: index
      }));
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id)
      };
    }
  }

  // ✅ IMPLEMENTAÇÃO CORRIGIDA: Otimização parcial para preservar pontos concluídos
  async optimizePartialRoute(
    completedPoints: OptimizationPoint[], 
    remainingPoints: OptimizationPoint[]
  ): Promise<OptimizationResult> {
    console.log(`🎯 [OPTIMIZER PARTIAL] Otimização parcial - ${completedPoints.length} concluídos, ${remainingPoints.length} restantes`);
    
    if (remainingPoints.length === 0) {
      console.log(`✅ [OPTIMIZER PARTIAL] Nenhum ponto pendente - retornando pontos concluídos`);
      return {
        optimizedPoints: completedPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: completedPoints.map(p => p.id)
      };
    }

    if (remainingPoints.length === 1) {
      console.log(`✅ [OPTIMIZER PARTIAL] Apenas 1 ponto pendente - concatenando`);
      const allPoints = [
        ...completedPoints,
        { ...remainingPoints[0], order: completedPoints.length }
      ];
      
      return {
        optimizedPoints: allPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: allPoints.map(p => p.id)
      };
    }

    try {
      // Usar último ponto concluído como origem para otimização dos pendentes
      const lastCompletedPoint = completedPoints[completedPoints.length - 1];
      
      console.log(`🚀 [OPTIMIZER PARTIAL] Otimizando a partir do último ponto concluído: ${lastCompletedPoint.address}`);
      
      // Criar lista para otimização: último concluído + pontos pendentes
      const pointsToOptimize = [
        { ...lastCompletedPoint, type: 'origin' as const },
        ...remainingPoints.slice(0, -1).map(p => ({ ...p, type: 'waypoint' as const })),
        { ...remainingPoints[remainingPoints.length - 1], type: 'destination' as const }
      ];

      // Otimizar apenas os pontos pendentes
      const optimizationResult = await this.optimizeRouteWithGoogleAPIs(pointsToOptimize);
      
      // Combinar: pontos concluídos (exceto o último, que foi usado como origem) + pontos otimizados
      const finalPoints = [
        ...completedPoints.slice(0, -1), // Todos os concluídos exceto o último
        ...optimizationResult.optimizedPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length - 1 + index, // Reordenar a partir do último concluído
          completed: index === 0 ? true : false // Primeiro ponto é o último concluído, resto são pendentes
        }))
      ];

      console.log(`✅ [OPTIMIZER PARTIAL] Otimização parcial concluída - ${finalPoints.length} pontos finais`);

      return {
        optimizedPoints: finalPoints,
        totalDistance: optimizationResult.totalDistance,
        totalDuration: optimizationResult.totalDuration,
        polyline: optimizationResult.polyline,
        optimizedOrder: finalPoints.map(p => p.id)
      };
      
    } catch (error) {
      console.error('❌ [OPTIMIZER PARTIAL] Erro na otimização parcial:', error);
      
      // Fallback: manter ordem atual sem otimização
      const fallbackPoints = [
        ...completedPoints,
        ...remainingPoints.map((p, index) => ({
          ...p,
          order: completedPoints.length + index,
          completed: false
        }))
      ];
      
      console.log(`⚠️ [OPTIMIZER PARTIAL] Usando fallback - ${fallbackPoints.length} pontos sem otimização`);
      
      return {
        optimizedPoints: fallbackPoints,
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        optimizedOrder: fallbackPoints.map(p => p.id)
      };
    }
  }
}

export const googleMapsOptimizer = new GoogleMapsOptimizer();
