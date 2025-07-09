declare global {
  interface Window {
    google: any;
  }
}

export class GoogleMapsService {
  private static instance: GoogleMapsService;
  private directionsService: any;
  private geocoder: any;
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): GoogleMapsService {
    if (!GoogleMapsService.instance) {
      GoogleMapsService.instance = new GoogleMapsService();
    }
    return GoogleMapsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isLoaded && window.google?.maps?.DirectionsService) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise((resolve, reject) => {
      if (window.google?.maps?.DirectionsService) {
        this.initializeServices();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAbITueefJWwTTyXO-9Nz9pgzbgKZ5sV9w&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        // Wait for Google Maps to be fully initialized
        const checkGoogleMaps = () => {
          if (window.google?.maps?.DirectionsService && window.google?.maps?.Geocoder) {
            this.initializeServices();
            resolve();
          } else {
            setTimeout(checkGoogleMaps, 100);
          }
        };
        checkGoogleMaps();
      };
      
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  private initializeServices(): void {
    try {
      this.directionsService = new window.google.maps.DirectionsService();
      this.geocoder = new window.google.maps.Geocoder();
      this.isLoaded = true;
      console.log('✅ Google Maps services initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Google Maps services:', error);
      throw error;
    }
  }

  async getAddressByCep(cep: string): Promise<{ address: string; lat: number; lng: number; cep: string }> {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json();
    
    if (viaCepData.erro) {
      throw new Error('CEP não encontrado');
    }

    const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
    
    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address }, (results: any[], status: string) => {
        if (status === 'OK' && results.length > 0) {
          const location = results[0].geometry.location;
          resolve({
            address,
            cep,
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          // Fallback para coordenadas padrão
          resolve({
            address,
            cep,
            lat: -23.5505,
            lng: -46.6333
          });
        }
      });
    });
  }

  async optimizeRoute(points: any[]): Promise<{
    optimizedOrder: string[];
    totalDistance: number;
    estimatedTime: string;
    polyline: string;
    detailedRoute: any;
  }> {
    if (!this.directionsService) {
      await this.initialize();
    }

    const origin = points.find(p => p.type === 'origin') || points[0];
    const destination = points.find(p => p.type === 'destination') || points[points.length - 1];
    const waypoints = points.filter(p => p.type === 'waypoint' || (p.id !== origin.id && p.id !== destination.id));

    const waypointsFormatted = waypoints.map(p => ({
      location: new window.google.maps.LatLng(p.lat, p.lng),
      stopover: true
    }));

    return new Promise((resolve, reject) => {
      this.directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypointsFormatted,
        optimizeWaypoints: true,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      }, (result: any, status: string) => {
        if (status === 'OK' && result) {
          const route = result.routes[0];
          let totalDistance = 0;
          let totalDuration = 0;

          route.legs.forEach((leg: any) => {
            totalDistance += leg.distance.value;
            totalDuration += leg.duration.value;
          });

          const hours = Math.floor(totalDuration / 3600);
          const minutes = Math.floor((totalDuration % 3600) / 60);
          const estimatedTime = `${hours}h ${minutes}min`;

          let optimizedOrder = [origin.id];
          if (route.waypoint_order && route.waypoint_order.length > 0) {
            optimizedOrder.push(...route.waypoint_order.map((index: number) => waypoints[index].id));
          }
          optimizedOrder.push(destination.id);

          resolve({
            optimizedOrder,
            totalDistance: totalDistance / 1000, // Convert to km
            estimatedTime,
            polyline: route.overview_polyline,
            detailedRoute: result
          });
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }

  async getDirections(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<any> {
    if (!this.directionsService) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC
      }, (result: any, status: string) => {
        if (status === 'OK') {
          resolve(result);
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }
}

export const googleMapsService = GoogleMapsService.getInstance();
