import type { TripFormData, Itinerary, Stop, RouteSegment, VoiceCommandResult, MidTripSuggestion, TransportMode } from './types';

const API_BASE = '/api';

export async function generateItinerary(
  data: TripFormData,
  onProgress?: (msg: string) => void
): Promise<Itinerary> {
  onProgress?.('Connecting to AI...');

  const resp = await fetch(`${API_BASE}/itinerary/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: data.destination,
      days: data.days,
      interests: data.interests,
      manual_places: data.manual_places,
      pace: data.pace,
      start_time: data.start_time,
      start_location: data.start_location || '',
      transport_mode: data.transport_mode || 'walking',
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `Generation failed: ${resp.status}`);
  }

  onProgress?.('Processing itinerary...');
  return resp.json();
}

export async function replanFromLocation(
  allStops: Stop[],
  skippedIds: string[],
  userLat: number,
  userLon: number,
  currentTime?: string,
  startTime?: string,
  transportMode: TransportMode = 'walking',
): Promise<{ stops: Stop[]; message: string }> {
  const resp = await fetch(`${API_BASE}/itinerary/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      all_stops: allStops,
      skipped_ids: skippedIds,
      current_lat: userLat,
      current_lon: userLon,
      current_time: currentTime || new Date().toISOString(),
      start_time: startTime || '09:00',
      transport_mode: transportMode,
    }),
  });

  if (!resp.ok) throw new Error('Replan failed');
  return resp.json();
}

export async function fetchRouteGeometry(
  stops: Stop[],
  transportMode: TransportMode = 'walking',
): Promise<RouteSegment[]> {
  if (stops.length < 2) return [];

  const resp = await fetch(`${API_BASE}/itinerary/route-geometry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stops: stops.map(s => ({ id: s.id, lat: s.lat, lon: s.lon, name: s.name })),
      transport_mode: transportMode,
    }),
  });

  if (!resp.ok) return [];
  const data = await resp.json();
  return data.segments || [];
}

export async function transcribeAudio(audioBlob: Blob, filename = 'recording.webm'): Promise<string> {
  const form = new FormData();
  form.append('audio', audioBlob, filename);

  const resp = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!resp.ok) throw new Error('Transcription failed');
  const data = await resp.json();
  return (data as { transcript: string }).transcript;
}

export async function parseVoiceCommand(
  transcript: string,
  itinerarySummary?: string
): Promise<VoiceCommandResult> {
  const resp = await fetch(`${API_BASE}/voice/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, itinerary_summary: itinerarySummary || '' }),
  });

  if (!resp.ok) throw new Error('Command parsing failed');
  return resp.json();
}

export async function getMidTripSuggestions(params: {
  destination: string;
  day_num: number;
  anchor_stop_id: string;
  anchor_stop_name: string;
  remaining_stops: Array<{ id: string; name: string; category: string }>;
  interests: string[];
  pace: string;
  user_request: string;
  n?: number;
  signal?: AbortSignal;
}): Promise<{
  anchor: string;
  request_summary: string;
  intent: string;
  suggestions: MidTripSuggestion[];
  cached: boolean;
}> {
  const resp = await fetch(`${API_BASE}/itinerary/midtrip-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, n: params.n ?? 5 }),
    signal: params.signal,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Suggestion generation failed');
  }
  return resp.json();
}

export async function applyMidTripSuggestions(payload: {
  destination: string;
  day_num: number;
  action_mode: 'insert' | 'replace' | 'remove';
  insert_placement?: 'before' | 'after';
  anchor_stop_id: string;
  selected_suggestions: any[];
  all_stops: any[];
  start_time?: string;
  transport_mode?: TransportMode;
  preserve_manual_order?: boolean;
  current_time?: string;
  current_lat?: number;
  current_lon?: number;
}) {
  const response = await fetch(`${API_BASE}/itinerary/midtrip-apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      start_time: payload.start_time || '09:00',
      transport_mode: payload.transport_mode || 'walking',
      preserve_manual_order: payload.preserve_manual_order ?? true,
      current_time: payload.current_time || '',
      current_lat: payload.current_lat ?? 0.0,
      current_lon: payload.current_lon ?? 0.0,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || 'Failed to apply mid-trip changes');
  }

  return data;
}

export function computeDayStats(stops: Stop[]): { totalDistanceKm: string; totalDurationHr: string } {
  // Use backend-provided route distances, NOT haversine
  const totalDistM = stops.reduce((sum, s) => sum + (s.travel_to_next_m || 0), 0);
  const totalDurMin = stops.reduce(
    (sum, s) => sum + s.duration_min + (s.travel_to_next_min || 0),
    0
  );
  return {
    totalDistanceKm: (totalDistM / 1000).toFixed(1),
    totalDurationHr: `${Math.floor(totalDurMin / 60)}h ${Math.round(totalDurMin % 60)}m`,
  };
}
