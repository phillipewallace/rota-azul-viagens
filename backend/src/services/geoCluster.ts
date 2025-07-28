
interface Point {
  id: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  completed?: boolean;
  completedAt?: string | null;
}

interface Cluster {
  id: number;
  points: Point[];
  centroid: { lat: number; lng: number };
}

export class GeoClusterService {
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
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

  private calculateCentroid(points: Point[]): { lat: number; lng: number } {
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return { lat, lng };
  }

  private getOptimalClusterCount(pointCount: number, maxPointsPerCluster: number = 25): number {
    return Math.ceil(pointCount / maxPointsPerCluster);
  }

  async clusterPoints(points: Point[], maxPointsPerCluster: number = 25): Promise<Cluster[]> {
    console.log(`🎯 [GEO CLUSTER] Iniciando clusterização de ${points.length} pontos`);
    
    if (points.length <= maxPointsPerCluster) {
      console.log(`✅ [GEO CLUSTER] Pontos <= ${maxPointsPerCluster}, retornando cluster único`);
      return [{
        id: 0,
        points: points,
        centroid: this.calculateCentroid(points)
      }];
    }

    const k = this.getOptimalClusterCount(points.length, maxPointsPerCluster);
    console.log(`📊 [GEO CLUSTER] Criando ${k} clusters para ${points.length} pontos`);

    // Initialize centroids randomly
    let centroids: { lat: number; lng: number }[] = [];
    for (let i = 0; i < k; i++) {
      const randomPoint = points[Math.floor(Math.random() * points.length)];
      centroids.push({ lat: randomPoint.lat, lng: randomPoint.lng });
    }

    let clusters: Cluster[] = [];
    let maxIterations = 50;
    let iteration = 0;

    while (iteration < maxIterations) {
      // Assign points to nearest centroid
      clusters = centroids.map((centroid, id) => ({
        id,
        points: [] as Point[],
        centroid
      }));

      for (const point of points) {
        let minDistance = Infinity;
        let nearestCluster = 0;

        for (let i = 0; i < centroids.length; i++) {
          const distance = this.calculateDistance(point, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = i;
          }
        }

        clusters[nearestCluster].points.push(point);
      }

      // Update centroids
      const newCentroids = clusters.map(cluster => 
        cluster.points.length > 0 ? this.calculateCentroid(cluster.points) : cluster.centroid
      );

      // Check for convergence
      let hasConverged = true;
      for (let i = 0; i < centroids.length; i++) {
        const distance = this.calculateDistance(centroids[i], newCentroids[i]);
        if (distance > 0.01) { // 10 meters tolerance
          hasConverged = false;
          break;
        }
      }

      centroids = newCentroids;
      clusters.forEach((cluster, i) => {
        cluster.centroid = centroids[i];
      });

      if (hasConverged) {
        console.log(`🔄 [GEO CLUSTER] K-means convergiu em ${iteration + 1} iterações`);
        break;
      }

      iteration++;
    }

    // Balance clusters to respect maxPointsPerCluster
    clusters = this.balanceClusters(clusters, maxPointsPerCluster);

    console.log(`✅ [GEO CLUSTER] Clusterização concluída: ${clusters.length} clusters`);
    clusters.forEach((cluster, i) => {
      console.log(`   Cluster ${i + 1}: ${cluster.points.length} pontos`);
    });

    return clusters;
  }

  private balanceClusters(clusters: Cluster[], maxPointsPerCluster: number): Cluster[] {
    const balancedClusters: Cluster[] = [];
    
    for (const cluster of clusters) {
      if (cluster.points.length <= maxPointsPerCluster) {
        balancedClusters.push(cluster);
      } else {
        // Split large clusters
        const points = cluster.points;
        const subClusters = Math.ceil(points.length / maxPointsPerCluster);
        
        for (let i = 0; i < subClusters; i++) {
          const start = i * maxPointsPerCluster;
          const end = Math.min(start + maxPointsPerCluster, points.length);
          const subClusterPoints = points.slice(start, end);
          
          if (subClusterPoints.length > 0) {
            balancedClusters.push({
              id: balancedClusters.length,
              points: subClusterPoints,
              centroid: this.calculateCentroid(subClusterPoints)
            });
          }
        }
      }
    }

    return balancedClusters;
  }

  optimizeClusterOrder(clusters: Cluster[], startPoint?: Point): Cluster[] {
    if (clusters.length <= 1) return clusters;

    console.log(`🔗 [GEO CLUSTER] Otimizando ordem de ${clusters.length} clusters`);

    const orderedClusters: Cluster[] = [];
    const remainingClusters = [...clusters];
    
    // Start with cluster containing startPoint or closest to it
    let currentCluster: Cluster;
    if (startPoint) {
      let minDistance = Infinity;
      let nearestIndex = 0;
      
      remainingClusters.forEach((cluster, index) => {
        const distance = this.calculateDistance(startPoint, cluster.centroid);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });
      
      currentCluster = remainingClusters.splice(nearestIndex, 1)[0];
    } else {
      currentCluster = remainingClusters.shift()!;
    }

    orderedClusters.push(currentCluster);

    // Greedy approach: always pick the nearest cluster
    while (remainingClusters.length > 0) {
      const lastCluster = orderedClusters[orderedClusters.length - 1];
      const lastPoint = lastCluster.points[lastCluster.points.length - 1];
      
      let minDistance = Infinity;
      let nearestIndex = 0;
      
      remainingClusters.forEach((cluster, index) => {
        const firstPoint = cluster.points[0];
        const distance = this.calculateDistance(lastPoint, firstPoint);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });
      
      const nextCluster = remainingClusters.splice(nearestIndex, 1)[0];
      orderedClusters.push(nextCluster);
    }

    console.log(`✅ [GEO CLUSTER] Ordem de clusters otimizada`);
    return orderedClusters;
  }
}

export const geoClusterService = new GeoClusterService();
