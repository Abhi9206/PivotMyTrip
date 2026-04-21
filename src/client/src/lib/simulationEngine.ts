import type { LatLng, Stop } from './types';

export const PROXIMITY_RADIUS_M = 150;
export const AUTO_CHECKIN_RADIUS_M = 80;

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function interpolatePosition(from: LatLng, to: LatLng, t: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lon: from.lon + (to.lon - from.lon) * t,
  };
}

export function generateSimulationPath(stops: Stop[], pointsPerSegment = 20): LatLng[] {
  if (stops.length === 0) return [];
  const path: LatLng[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from: LatLng = { lat: stops[i].lat, lon: stops[i].lon };
    const to: LatLng = { lat: stops[i + 1].lat, lon: stops[i + 1].lon };
    for (let j = 0; j <= pointsPerSegment; j++) {
      path.push(interpolatePosition(from, to, j / pointsPerSegment));
    }
  }
  const last = stops[stops.length - 1];
  path.push({ lat: last.lat, lon: last.lon });
  return path;
}

export function isInProximity(
  userPos: LatLng,
  stopPos: LatLng,
  radius = PROXIMITY_RADIUS_M
): boolean {
  return haversineDistance(userPos, stopPos) <= radius;
}

export function isInAutoCheckIn(userPos: LatLng, stopPos: LatLng): boolean {
  return haversineDistance(userPos, stopPos) <= AUTO_CHECKIN_RADIUS_M;
}

export function findActiveStop(stops: Stop[]): Stop | null {
  return (
    stops.find(s => s.status === 'in-progress') ||
    stops.find(s => s.status === 'approaching') ||
    stops.find(s => s.status === 'pending') ||
    null
  );
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return '#22c55e';
    case 'in-progress':
      return '#f97316';
    case 'approaching':
      return '#eab308';
    case 'skipped':
      return '#6b7280';
    default:
      return '#3b82f6';
  }
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    culture: '#8b5cf6',
    food: '#ef4444',
    nature: '#22c55e',
    shopping: '#f59e0b',
    entertainment: '#3b82f6',
    transport: '#6b7280',
    accommodation: '#ec4899',
  };
  return colors[category] || '#6366f1';
}
