export type LocationStatus = 'pending' | 'approaching' | 'in-progress' | 'completed' | 'skipped';
export type TravelPace = 'relaxed' | 'balanced' | 'fast';
export type VoiceIntent =
  | 'generate_itinerary'
  | 'add_stop'
  | 'remove_stop'
  | 'skip_stop'
  | 'replan'
  | 'change_pace'
  | 'set_destination'
  | 'unknown';

export interface LatLng {
  lat: number;
  lon: number;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
  description: string;
  duration_min: number;
  planned_start: string;
  planned_end: string;
  status: LocationStatus;
  visit_order: number;
  distance_from_user?: number;
  eta_min?: number;
  travel_to_next_min: number;
  travel_to_next_m: number;
  route_is_fallback: boolean;
}

export interface DayPlan {
  day: number;
  theme: string;
  overview: string;
  stops: Stop[];
  total_distance_m: number;
  total_duration_min: number;
}

export interface Itinerary {
  destination: string;
  days: number;
  overview: string;
  plan: DayPlan[];
  cached: boolean;
  generated_at: string;
  llm_provider: string;
}

export type TransportMode = 'walking' | 'cycling' | 'driving';

export interface TripFormData {
  destination: string;
  days: number;
  interests: string[];
  manual_places: string[];
  pace: TravelPace;
  start_time: string;
  start_location: string;
  transport_mode: TransportMode;
}

export interface MidTripSuggestion {
  name: string;
  category: string;
  estimated_duration_min: number;
  description: string;
}

export interface MidTripState {
  isOpen: boolean;
  isLoading: boolean;
  suggestions: MidTripSuggestion[];
  requestSummary: string;
  intent: string;
  selectedIndices: number[];
  actionMode: 'insert_after' | 'replace' | 'append';
  anchorStopId: string;
  userRequest: string;
  error: string;
  cached: boolean;
}

export interface SimulationState {
  isRunning: boolean;
  speed: number;
  currentDayIndex: number;
  userPosition: LatLng | null;
  simulationTime: Date;
  pathIndex: number;
  elapsedAtStop: number;
  autoCheckIn: boolean;
  current_stop_index: number;  // Index of the active (next unvisited) stop in the day's stop array
}

export interface RouteStep {
  instruction: string;      // street / road name
  distance_m: number;
  duration_s: number;
  maneuver_type: string;    // turn | depart | arrive | continue | …
  maneuver_modifier: string; // left | right | slight left | straight | …
}

export interface RouteSegment {
  from_id: string;
  to_id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distance_m: number;
  duration_s: number;
  is_fallback: boolean;
  steps?: RouteStep[];
}

export interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}
export interface VoiceCommandResult {
  intent: VoiceIntent;
  confidence: number;
  params: {
    destination?: string;
    days?: number;
    pace?: TravelPace;
    stop_name?: string;
    stop_after?: string;
    interests?: string[];
    start_location?: string;
    start_time?: string;
    transport_mode?: TransportMode;
    manual_places?: string[];
  };
  human_response: string;
}
