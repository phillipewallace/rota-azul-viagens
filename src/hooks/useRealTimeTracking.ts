import { useState, useEffect, useCallback } from 'react';
import { trafficService } from '@/services/traffic';
import { useBackgroundTracking } from '@/hooks/useBackgroundTracking';

interface TruckLocation {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

interface TrackingData {
  truckId: string;
  currentLocation: TruckLocation | null;
  nextDestination: {
    address: string;
    lat: number;
    lng: number;
    eta: string;
    distance: string;
    duration: string;
    durationInTraffic: string;
  } | null;
  route: {
    totalDistance: string;
    totalDuration: string;
    totalDurationInTraffic: string;
    completedPoints: number;
    remainingPoints: number;
  } | null;
}

export const useRealTimeTracking = (truckId: string | null, routePoints: any[] = []) => {
  // Usar o novo hook de background tracking
  const {
    trackingData,
    isTracking,
    loading,
    error,
    startTracking,
    stopTracking
  } = useBackgroundTracking(truckId, routePoints);

  return {
    trackingData,
    isTracking,
    loading,
    error,
    startTracking,
    stopTracking
  };
};
