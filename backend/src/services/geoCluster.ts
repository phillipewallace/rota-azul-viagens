
interface ClusterPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  type: 'origin' | 'destination' | 'waypoint';
  completed?: boolean;
  completedAt?: string;
}

interface Cluster {
  id: string;
  points: ClusterPoint[];
  centroid: { lat: number; lng: number };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

class GeoClusterService {
  private readonly MAX_CLUSTER_SIZE = 20; // Máximo de pontos por cluster
  private readonly MIN_CLUSTER_SIZE = 3; // Mínimo de pontos por cluster

  /**
   * Clusteriza pontos geograficamente usando K-means adaptado
   */
  async clusterizePoints(points: ClusterPoint[]): Promise<Cluster[]> {
    console.log(`🎯 [GEO CLUSTER] Iniciando clusterização de ${points.length} pontos`);
    
    if (points.length <= 25) {
      // Se <= 25 pontos, criar um único cluster
      return [this.createSingleCluster(points)];
    }

    // Separar pontos especiais (origin/destination) dos waypoints
    const specialPoints = points.filter(p => p.type === 'origin' || p.type === 'destination');
    const waypoints = points.filter(p => p.type === 'waypoint');
    
    console.log(`📊 [GEO CLUSTER] ${specialPoints.length} pontos especiais, ${waypoints.length} waypoints`);

    // Calcular número ideal de clusters
    const numClusters = Math.ceil(waypoints.length / this.MAX_CLUSTER_SIZE);
    console.log(`🔢 [GEO CLUSTER] Criando ${numClusters} clusters`);

    // Aplicar K-means nos waypoints
    const clusters = await this.kMeansCluster(waypoints, numClusters);
    
    // Distribuir pontos especiais entre os clusters
    const finalClusters = this.distributeSpecialPoints(clusters, specialPoints);
    
    console.log(`✅ [GEO CLUSTER] Clusterização concluída: ${finalClusters.length} clusters`);
    return finalClusters;
  }

  /**
   * Algoritmo K-means adaptado para pontos geográficos
   */
  private async kMeansCluster(points: ClusterPoint[], numClusters: number): Promise<Cluster[]> {
    if (points.length === 0) return [];
    
    // Inicializar centroides usando K-means++
    const centroids = this.initializeCentroids(points, numClusters);
    
    let clusters: Cluster[] = [];
    let converged = false;
    let iterations = 0;
    const maxIterations = 50;

    while (!converged && iterations < maxIterations) {
      // Atribuir pontos aos clusters mais próximos
      const newClusters = this.assignPointsToClusters(points, centroids);
      
      // Recalcular centroides
      const newCentroids = newClusters.map(cluster => this.calculateCentroid(cluster.points));
      
      // Verificar convergência
      converged = this.hasConverged(centroids, newCentroids);
      
      clusters = newClusters;
      centroids.splice(0, centroids.length, ...newCentroids);
      iterations++;
    }

    console.log(`🔄 [GEO CLUSTER] K-means convergiu em ${iterations} iterações`);
    return clusters;
  }

  /**
   * Inicializa centroides usando K-means++
   */
  private initializeCentroids(points: ClusterPoint[], numClusters: number): { lat: number; lng: number }[] {
    const centroids: { lat: number; lng: number }[] = [];
    
    // Primeiro centroide aleatório
    const firstPoint = points[Math.floor(Math.random() * points.length)];
    centroids.push({ lat: firstPoint.lat, lng: firstPoint.lng });

    // Selecionar centroides restantes com base na distância
    for (let i = 1; i < numClusters; i++) {
      const distances = points.map(point => {
        const minDistance = Math.min(...centroids.map(centroid => 
          this.calculateDistance(point, centroid)
        ));
        return minDistance * minDistance; // Quadrado da distância
      });

      const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
      const randomValue = Math.random() * totalDistance;
      
      let cumulativeDistance = 0;
      for (let j = 0; j < points.length; j++) {
        cumulativeDistance += distances[j];
        if (cumulativeDistance >= randomValue) {
          centroids.push({ lat: points[j].lat, lng: points[j].lng });
          break;
        }
      }
    }

    return centroids;
  }

  /**
   * Atribui pontos aos clusters mais próximos
   */
  private assignPointsToClusters(points: ClusterPoint[], centroids: { lat: number; lng: number }[]): Cluster[] {
    const clusters: Cluster[] = centroids.map((centroid, index) => ({
      id: `cluster-${index}`,
      points: [],
      centroid,
      bounds: { north: -90, south: 90, east: -180, west: 180 }
    }));

    // Atribuir cada ponto ao cluster mais próximo
    points.forEach(point => {
      let minDistance = Infinity;
      let closestClusterIndex = 0;

      centroids.forEach((centroid, index) => {
        const distance = this.calculateDistance(point, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestClusterIndex = index;
        }
      });

      clusters[closestClusterIndex].points.push(point);
    });

    // Atualizar bounds de cada cluster
    clusters.forEach(cluster => {
      cluster.bounds = this.calculateBounds(cluster.points);
    });

    return clusters;
  }

  /**
   * Calcula o centroide de um conjunto de pontos
   */
  private calculateCentroid(points: ClusterPoint[]): { lat: number; lng: number } {
    if (points.length === 0) return { lat: 0, lng: 0 };

    const totalLat = points.reduce((sum, point) => sum + point.lat, 0);
    const totalLng = points.reduce((sum, point) => sum + point.lng, 0);

    return {
      lat: totalLat / points.length,
      lng: totalLng / points.length
    };
  }

  /**
   * Verifica se os centroides convergiram
   */
  private hasConverged(oldCentroids: { lat: number; lng: number }[], newCentroids: { lat: number; lng: number }[]): boolean {
    const threshold = 0.001; // ~100 metros
    
    for (let i = 0; i < oldCentroids.length; i++) {
      const distance = this.calculateDistance(oldCentroids[i], newCentroids[i]);
      if (distance > threshold) return false;
    }
    
    return true;
  }

  /**
   * Distribui pontos especiais entre os clusters
   */
  private distributeSpecialPoints(clusters: Cluster[], specialPoints: ClusterPoint[]): Cluster[] {
    specialPoints.forEach(specialPoint => {
      // Encontrar cluster mais próximo
      let closestCluster = clusters[0];
      let minDistance = Infinity;

      clusters.forEach(cluster => {
        const distance = this.calculateDistance(specialPoint, cluster.centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = cluster;
        }
      });

      // Adicionar ao cluster mais próximo
      closestCluster.points.push(specialPoint);
      
      // Atualizar bounds
      closestCluster.bounds = this.calculateBounds(closestCluster.points);
    });

    return clusters;
  }

  /**
   * Cria um único cluster com todos os pontos
   */
  private createSingleCluster(points: ClusterPoint[]): Cluster {
    return {
      id: 'cluster-0',
      points,
      centroid: this.calculateCentroid(points),
      bounds: this.calculateBounds(points)
    };
  }

  /**
   * Calcula os bounds de um conjunto de pontos
   */
  private calculateBounds(points: ClusterPoint[]): { north: number; south: number; east: number; west: number } {
    if (points.length === 0) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);

    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }

  /**
   * Calcula distância entre dois pontos usando fórmula de Haversine
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const geoClusterService = new GeoClusterService();
