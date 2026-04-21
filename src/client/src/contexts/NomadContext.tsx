import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  Itinerary,
  SimulationState,
  Notification,
  TripFormData,
  RouteSegment,
  LatLng,
  Stop,
} from '../lib/types';
import {
  generateItinerary,
  replanFromLocation,
  fetchRouteGeometry,
} from '../lib/apiService';
import {
  generateSimulationPath,
  haversineDistance,
  AUTO_CHECKIN_RADIUS_M,
} from '../lib/simulationEngine';
import { geocodeStartLocation } from '../lib/geocodeHelper';

const AUTO_CHECKOUT_RADIUS_M = 200;
const APPROACH_RADIUS_M = 150;
const SNAP_TO_STOP_RADIUS_M = 120;

interface NomadContextType {
  itinerary: Itinerary | null;           // active itinerary (confirmed ?? draft)
  draftItinerary: Itinerary | null;
  confirmedItinerary: Itinerary | null;
  tripFormData: TripFormData | null;
  currentDayIndex: number;
  simulationState: SimulationState;
  notifications: Notification[];
  isGenerating: boolean;
  generationProgress: string;
  routeSegments: RouteSegment[];
  startPosition: LatLng | null;
  isRoutingLoading: boolean;
  generateTrip: (data: TripFormData) => Promise<void>;
  confirmTrip: () => void;
  clearDraftTrip: () => void;
  updateDraftItinerary: (
    dayIdx: number,
    newStops: Stop[],
    totalDistM: number,
    totalDurMin: number
  ) => void;
  checkIn: (stopId: string) => void;
  skipStop: (stopId: string) => void;
  markDone: (stopId: string) => void;
  replan: () => Promise<void>;
  applyStopsUpdate: (
    dayIdx: number,
    newStops: Stop[],
    totalDistM: number,
    totalDurMin: number
  ) => void;
  nextDay: () => void;
  prevDay: () => void;
  goToDay: (index: number) => void;
  setSimSpeed: (speed: number) => void;
  toggleSim: () => void;
  toggleAutoCheckIn: () => void;
  addNotification: (type: Notification['type'], message: string) => void;
  dismissNotification: (id: string) => void;
}

const NomadContext = createContext<NomadContextType | null>(null);

/** Build a Date set to today at the user's configured start time (e.g. "09:00"). */
function buildStartTime(startTimeStr: string | undefined): Date {
  const t = startTimeStr || '09:00';
  try {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
    return d;
  } catch {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  }
}

function samePoint(a: LatLng | null | undefined, b: LatLng | null | undefined, tol = 0.000001) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < tol && Math.abs(a.lon - b.lon) < tol;
}

function findClosestPathIndex(path: LatLng[], pos: LatLng | null): number {
  if (!pos || path.length === 0) return 0;

  let minDist = Number.POSITIVE_INFINITY;
  let bestIdx = 0;

  for (let i = 0; i < path.length; i++) {
    const dist = haversineDistance(path[i], pos);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export function NomadProvider({ children }: { children: React.ReactNode }) {
  const [draftItinerary, setDraftItinerary] = useState<Itinerary | null>(null);
  const [confirmedItinerary, setConfirmedItinerary] = useState<Itinerary | null>(null);
  const [tripFormData, setTripFormData] = useState<TripFormData | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [startPosition, setStartPosition] = useState<LatLng | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    speed: 1,
    currentDayIndex: 0,
    userPosition: null,
    simulationTime: new Date(),
    pathIndex: 0,
    elapsedAtStop: 0,
    autoCheckIn: true,
    current_stop_index: 0,
  });

  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simPathRef = useRef<LatLng[]>([]);
  const routeFetchSeqRef = useRef(0);
  const simStateRef = useRef(simulationState);
  const tripFormDataRef = useRef(tripFormData);
  // Tracks which day index has already received the 9pm warning so it fires only once per day.
  const warned9pmDayRef = useRef<number>(-1);

  const activeItinerary = confirmedItinerary ?? draftItinerary;

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('nomad_draft_itinerary');
      const savedConfirmed = localStorage.getItem('nomad_confirmed_itinerary');
      const savedFd = localStorage.getItem('nomad_formdata');
      const savedSimState = localStorage.getItem('nomad_simulation_state');

      if (savedDraft) setDraftItinerary(JSON.parse(savedDraft));
      if (savedConfirmed) setConfirmedItinerary(JSON.parse(savedConfirmed));
      if (savedFd) setTripFormData(JSON.parse(savedFd));

      if (savedSimState) {
        const parsed = JSON.parse(savedSimState);
        setSimulationState((prev) => ({
          ...prev,
          userPosition: parsed.userPosition ?? null,
          pathIndex: parsed.pathIndex ?? 0,
          simulationTime: parsed.simulationTime ? new Date(parsed.simulationTime) : new Date(),
          currentDayIndex: parsed.currentDayIndex ?? 0,
          speed: parsed.speed ?? 1,
          autoCheckIn: parsed.autoCheckIn ?? true,
          current_stop_index: parsed.current_stop_index ?? 0,
          isRunning: false, // always start paused on reload
        }));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    if (draftItinerary) {
      localStorage.setItem('nomad_draft_itinerary', JSON.stringify(draftItinerary));
    } else {
      localStorage.removeItem('nomad_draft_itinerary');
    }
  }, [draftItinerary]);

  useEffect(() => {
    if (confirmedItinerary) {
      localStorage.setItem('nomad_confirmed_itinerary', JSON.stringify(confirmedItinerary));
    } else {
      localStorage.removeItem('nomad_confirmed_itinerary');
    }
  }, [confirmedItinerary]);

  useEffect(() => {
    if (tripFormData) {
      localStorage.setItem('nomad_formdata', JSON.stringify(tripFormData));
    }
  }, [tripFormData]);

  useEffect(() => {
    localStorage.setItem(
      'nomad_simulation_state',
      JSON.stringify({
        userPosition: simulationState.userPosition,
        pathIndex: simulationState.pathIndex,
        simulationTime: simulationState.simulationTime.toISOString(),
        currentDayIndex: simulationState.currentDayIndex,
        speed: simulationState.speed,
        autoCheckIn: simulationState.autoCheckIn,
        current_stop_index: simulationState.current_stop_index,
      })
    );
  }, [simulationState]);

  useEffect(() => {
    if (!tripFormData?.start_location) {
      setStartPosition(null);
      return;
    }

    let cancelled = false;
    geocodeStartLocation(tripFormData.start_location, tripFormData.destination)
      .then((pos) => {
        if (!cancelled) setStartPosition(pos);
      })
      .catch(() => {
        if (!cancelled) setStartPosition(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tripFormData?.start_location, tripFormData?.destination]);

  useEffect(() => {
    simStateRef.current = simulationState;
  }, [simulationState]);

  useEffect(() => {
    tripFormDataRef.current = tripFormData;
  }, [tripFormData]);

  const refreshRouteSegments = useCallback(
    async (stops: Stop[], homePos?: LatLng | null, transportMode?: string) => {
      const requestId = ++routeFetchSeqRef.current;
      setIsRoutingLoading(true);


      if (stops.length < 2) {
        setIsRoutingLoading(false);
        return [];
      }

      let stopsForRouting = stops;
      if (homePos) {
        const homeStart: Stop = {
          id: '__home_start__',
          name: 'Home / Hotel',
          lat: homePos.lat,
          lon: homePos.lon,
          category: 'accommodation',
          duration_min: 0,
          visit_order: 0,
          status: 'pending',
          travel_to_next_m: 0,
          travel_to_next_min: 0,
          route_is_fallback: false,
        } as Stop;

        const homeEnd: Stop = {
          ...homeStart,
          id: '__home_end__',
        };

        stopsForRouting = [homeStart, ...stops, homeEnd];
      }

      const mode = (transportMode || 'walking') as import('../lib/types').TransportMode;

      try {
        const segments = await fetchRouteGeometry(stopsForRouting, mode);
        if (requestId === routeFetchSeqRef.current) {
          setRouteSegments(segments);
        }
        return segments;
      } catch {
        if (requestId === routeFetchSeqRef.current) {
          setRouteSegments([]);
        }
        return [];
      } finally {
        if (requestId === routeFetchSeqRef.current) {
          setIsRoutingLoading(false);
        }
      }
    },
    []
  );

  const addNotification = useCallback(
    (type: Notification['type'], message: string) => {
      const note: Notification = {
        id: Math.random().toString(36).slice(2),
        type,
        message,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [...prev, note]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== note.id));
      }, 4000);
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const generateTrip = useCallback(
    async (data: TripFormData) => {
      setIsGenerating(true);
      setGenerationProgress('Starting...');

      try {
        const result = await generateItinerary(data, (msg) => setGenerationProgress(msg));

        setDraftItinerary(result);
        setConfirmedItinerary(null);
        setTripFormData(data);
        setCurrentDayIndex(0);

        setSimulationState((prev) => ({
          ...prev,
          isRunning: false,
          pathIndex: 0,
          elapsedAtStop: 0,
          userPosition: null,
          currentDayIndex: 0,
          simulationTime: buildStartTime(data.start_time),
          current_stop_index: 0,
        }));
        simPathRef.current = [];
        warned9pmDayRef.current = -1;

        if (result.plan.length > 0) {
          await Promise.allSettled(
            result.plan.map((d, i) =>
              i === 0
                ? refreshRouteSegments(d.stops, startPosition, data.transport_mode)
                : fetchRouteGeometry(
                    d.stops,
                    (data.transport_mode || 'walking') as 'walking' | 'cycling' | 'driving'
                  ).catch(() => [])
            )
          );
        }

        addNotification(
          result.cached ? 'info' : 'success',
          result.cached
            ? 'Loaded from cache!'
            : `Itinerary generated with ${result.llm_provider || 'AI'}!`
        );
      } catch (err) {
        const msg = (err as Error).message || 'Generation failed';
        addNotification('error', msg);
        setIsGenerating(false);
        setGenerationProgress('');
        throw err;
      } finally {
        setIsGenerating(false);
        setGenerationProgress('');
      }
    },
    [addNotification, refreshRouteSegments, startPosition]
  );

  const confirmTrip = useCallback(() => {
    if (!draftItinerary) return;

    setConfirmedItinerary(draftItinerary);
    setSimulationState((prev) => ({
      ...prev,
      isRunning: false,
      pathIndex: 0,
      elapsedAtStop: 0,
      userPosition: null,
      currentDayIndex: 0,
      simulationTime: buildStartTime(tripFormData?.start_time),
      current_stop_index: 0,
    }));
    simPathRef.current = [];
    localStorage.removeItem('nomad_simulation_state');

    addNotification('success', 'Trip confirmed. Live tracking is ready.');
  }, [draftItinerary, addNotification]);

  const clearDraftTrip = useCallback(() => {
    setDraftItinerary(null);
  }, []);

  const updateDraftItinerary = useCallback(
    async (dayIdx: number, newStops: Stop[], totalDistM: number, totalDurMin: number) => {
      setDraftItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: prev.plan.map((d, i) =>
            i === dayIdx
              ? {
                  ...d,
                  stops: newStops,
                  total_distance_m: totalDistM,
                  total_duration_min: totalDurMin,
                }
              : d
          ),
        };
      });

      setTimeout(() => {
        refreshRouteSegments(newStops, startPosition, tripFormData?.transport_mode);
      }, 0);

      addNotification('success', 'Draft itinerary updated.');
    },
    [refreshRouteSegments, startPosition, tripFormData?.transport_mode, addNotification]
  );

  useEffect(() => {
  if (!activeItinerary) return;
  const day = activeItinerary.plan[currentDayIndex];
  if (!day) return;

  refreshRouteSegments(day.stops, startPosition, tripFormData?.transport_mode);
}, [activeItinerary, currentDayIndex, startPosition, tripFormData?.transport_mode, refreshRouteSegments]);

  const updateStopsForDay = useCallback(
    (dayIdx: number, updater: (stops: Stop[]) => Stop[]) => {
      setConfirmedItinerary((prev) => {
        if (!prev) return prev;
        const newPlan = prev.plan.map((d, i) => {
          if (i !== dayIdx) return d;
          return { ...d, stops: updater(d.stops) };
        });
        return { ...prev, plan: newPlan };
      });
    },
    []
  );

  const resetCurrentDayStatuses = useCallback(() => {
    setConfirmedItinerary((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        plan: prev.plan.map((day, i) => {
          if (i !== currentDayIndex) return day;

          return {
            ...day,
            stops: day.stops.map((stop) => ({
              ...stop,
              status: 'pending' as const,
            })),
          };
        }),
      };
    });
  }, [currentDayIndex]);

  const checkIn = useCallback(
    (stopId: string) => {
      updateStopsForDay(currentDayIndex, (stops) =>
        stops.map((s) =>
          s.id === stopId && s.status !== 'completed'
            ? { ...s, status: 'in-progress' }
            : s
        )
      );
      addNotification('info', 'Checked in!');
    },
    [currentDayIndex, updateStopsForDay, addNotification]
  );

  const markDone = useCallback(
    (stopId: string) => {
      updateStopsForDay(currentDayIndex, (stops) =>
        stops.map((s) => (s.id === stopId ? { ...s, status: 'completed' } : s))
      );
      addNotification('success', 'Stop marked complete!');
    },
    [currentDayIndex, updateStopsForDay, addNotification]
  );

  const skipStop = useCallback(
    (stopId: string) => {
      updateStopsForDay(currentDayIndex, (stops) =>
        stops.map((s) => (s.id === stopId ? { ...s, status: 'skipped' } : s))
      );
      addNotification('warning', 'Stop skipped.');
    },
    [currentDayIndex, updateStopsForDay, addNotification]
  );

  const replan = useCallback(async () => {
    if (!confirmedItinerary) return;
    const day = confirmedItinerary.plan[currentDayIndex];
    if (!day) return;

    const userPos = simulationState.userPosition;
    let lat = 0;
    let lon = 0;

    if (userPos) {
      lat = userPos.lat;
      lon = userPos.lon;
    } else {
      const firstPending = day.stops.find(
        (s) => s.status !== 'completed' && s.status !== 'skipped'
      );
      if (firstPending) {
        lat = firstPending.lat;
        lon = firstPending.lon;
      }
    }

    const startTime = tripFormData?.start_time || '09:00';
    // Use the *simulated* clock time (not real wall-clock) so rescheduled stops
    // stay aligned with the simulation timeline for the current day.
    const currentTime = userPos
      ? simulationState.simulationTime.toISOString()
      : buildStartTime(startTime).toISOString();

    try {
      const { stops } = await replanFromLocation(
        day.stops,
        [],
        lat,
        lon,
        currentTime,
        startTime,
        (tripFormData?.transport_mode || 'walking') as 'walking' | 'cycling' | 'driving'
      );
      updateStopsForDay(currentDayIndex, () => stops);

      setSimulationState((prev) => ({
        ...prev,
        isRunning: false,
        pathIndex: 0,
        elapsedAtStop: 0,
        userPosition: null,
        current_stop_index: 0,
      }));
      simPathRef.current = [];

      addNotification('success', 'Route optimised!');
      await refreshRouteSegments(stops, startPosition, tripFormData?.transport_mode);
    } catch {
      addNotification('error', 'Replan failed');
    }
  }, [
    confirmedItinerary,
    currentDayIndex,
    simulationState.userPosition,
    simulationState.simulationTime,
    tripFormData,
    updateStopsForDay,
    addNotification,
    refreshRouteSegments,
    startPosition,
  ]);

  const applyStopsUpdate = useCallback(
    async (dayIdx: number, newStops: Stop[], totalDistM: number, totalDurMin: number) => {
      const currentPos = simStateRef.current.userPosition;
      const currentTime = simStateRef.current.simulationTime;
      const currentSpeed = simStateRef.current.speed;
      const currentAutoCheckIn = simStateRef.current.autoCheckIn;

      setConfirmedItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plan: prev.plan.map((d, i) =>
            i === dayIdx
              ? {
                  ...d,
                  stops: newStops,
                  total_distance_m: totalDistM,
                  total_duration_min: totalDurMin,
                }
              : d
          ),
        };
      });

      if (dayIdx === currentDayIndex) {
  const stopsForPath = newStops.filter(
    (s) => s.status !== 'completed' && s.status !== 'skipped'
  );

  const effectiveStopsForPath =
    stopsForPath.length > 0 ? stopsForPath : newStops;

  const segments = await refreshRouteSegments(
    effectiveStopsForPath,
    currentPos ?? startPosition,
    tripFormData?.transport_mode
  );

        const buildPathFromStops = (): LatLng[] => {
          if (segments.length > 0) {
            const fullPath: LatLng[] = [];

            if (currentPos) {
              fullPath.push(currentPos);
            } else if (startPosition) {
              fullPath.push(startPosition);
            } else if (stopsForPath.length > 0) {
              fullPath.push({ lat: stopsForPath[0].lat, lon: stopsForPath[0].lon });
            }

            for (let segIndex = 0; segIndex < segments.length; segIndex++) {
              const seg = segments[segIndex];
              const coords = seg.geometry.coordinates;
              const segmentPath: LatLng[] = [];

              if (coords.length <= 2 || seg.is_fallback) {
                if (coords.length >= 2) {
                  const [fromLon, fromLat] = coords[0];
                  const [toLon, toLat] = coords[coords.length - 1];
                  const STEPS = 30;
                  for (let i = 0; i <= STEPS; i++) {
                    segmentPath.push({
                      lat: fromLat + (toLat - fromLat) * (i / STEPS),
                      lon: fromLon + (toLon - fromLon) * (i / STEPS),
                    });
                  }
                }
              } else {
                for (const [lon, lat] of coords) {
                  segmentPath.push({ lat, lon });
                }
              }

              for (const point of segmentPath) {
                const last = fullPath[fullPath.length - 1];
                if (!samePoint(last, point)) {
                  fullPath.push(point);
                }
              }

              const stopTargetIndex = segIndex;
              if (stopTargetIndex >= 0 && stopTargetIndex < stopsForPath.length) {
                const stopPoint = {
                  lat: stopsForPath[stopTargetIndex].lat,
                  lon: stopsForPath[stopTargetIndex].lon,
                };
                const last = fullPath[fullPath.length - 1];
                if (!samePoint(last, stopPoint)) {
                  fullPath.push(stopPoint);
                }
              }
            }

            if (fullPath.length > 0) return fullPath;
          }

          const fallbackStops = currentPos
            ? [
                { ...stopsForPath[0], lat: currentPos.lat, lon: currentPos.lon, id: '__current_start__' },
                ...stopsForPath,
              ]
            : startPosition
            ? [
                { ...stopsForPath[0], lat: startPosition.lat, lon: startPosition.lon, id: '__home_start__' },
                ...stopsForPath,
              ]
            : stopsForPath;

          return generateSimulationPath(fallbackStops);
        };

        const rebuiltPath = buildPathFromStops();
        const closestIdx = findClosestPathIndex(rebuiltPath, currentPos);
        simPathRef.current = rebuiltPath;

        setSimulationState((prev) => ({
          ...prev,
          isRunning: false,
          currentDayIndex: dayIdx,
          pathIndex: closestIdx,
          elapsedAtStop: 0,
          userPosition: currentPos ?? rebuiltPath[closestIdx] ?? null,
          simulationTime: currentTime,
          speed: currentSpeed,
          autoCheckIn: currentAutoCheckIn,
          current_stop_index: prev.current_stop_index,
        }));
      }

      addNotification('success', 'Stops updated with AI suggestions!');
    },
    [currentDayIndex, refreshRouteSegments, startPosition, tripFormData?.transport_mode, addNotification]
  );

  const nextDay = useCallback(() => {
    if (!activeItinerary) return;
    const next = Math.min(currentDayIndex + 1, activeItinerary.plan.length - 1);
    setCurrentDayIndex(next);
    setSimulationState((prev) => ({
      ...prev,
      currentDayIndex: next,
      pathIndex: 0,
      elapsedAtStop: 0,
      isRunning: false,
      userPosition: null,
      simulationTime: buildStartTime(tripFormData?.start_time),
      current_stop_index: 0,
    }));
    simPathRef.current = [];
  }, [activeItinerary, currentDayIndex, tripFormData?.start_time]);

  const prevDay = useCallback(() => {
    const prev = Math.max(currentDayIndex - 1, 0);
    setCurrentDayIndex(prev);
    setSimulationState((prev2) => ({
      ...prev2,
      currentDayIndex: prev,
      pathIndex: 0,
      elapsedAtStop: 0,
      isRunning: false,
      userPosition: null,
      simulationTime: buildStartTime(tripFormData?.start_time),
      current_stop_index: 0,
    }));
    simPathRef.current = [];
  }, [currentDayIndex, tripFormData?.start_time]);

  const goToDay = useCallback(
    (index: number) => {
      if (!activeItinerary) return;
      const clamped = Math.max(0, Math.min(index, activeItinerary.plan.length - 1));
      setCurrentDayIndex(clamped);
      setSimulationState((prev) => ({
        ...prev,
        currentDayIndex: clamped,
        pathIndex: 0,
        elapsedAtStop: 0,
        isRunning: false,
        userPosition: null,
        simulationTime: buildStartTime(tripFormData?.start_time),
        current_stop_index: 0,
      }));
      simPathRef.current = [];
    },
    [activeItinerary, tripFormData?.start_time]
  );

  const setSimSpeed = useCallback((speed: number) => {
    setSimulationState((prev) => ({ ...prev, speed }));
  }, []);

  const buildSimPath = useCallback(
    (stops: Stop[], originOverride?: LatLng | null): LatLng[] => {
      const effectiveOrigin = originOverride ?? startPosition;

      // Only path through stops that haven't been visited yet.
      // Completed/skipped stops are done — including them causes the simulation
      // to backtrack through already-visited locations.
      const stopsForPath = stops;

      if (routeSegments.length > 0) {
        const fullPath: LatLng[] = [];

        if (effectiveOrigin) {
          fullPath.push(effectiveOrigin);
        } else if (stopsForPath.length > 0) {
          fullPath.push({ lat: stopsForPath[0].lat, lon: stopsForPath[0].lon });
        }

        for (let segIndex = 0; segIndex < routeSegments.length; segIndex++) {
          const seg = routeSegments[segIndex];
          const coords = seg.geometry.coordinates;
          const segmentPath: LatLng[] = [];

          if (coords.length <= 2 || seg.is_fallback) {
            if (coords.length >= 2) {
              const [fromLon, fromLat] = coords[0];
              const [toLon, toLat] = coords[coords.length - 1];
              const STEPS = 30;
              for (let i = 0; i <= STEPS; i++) {
                segmentPath.push({
                  lat: fromLat + (toLat - fromLat) * (i / STEPS),
                  lon: fromLon + (toLon - fromLon) * (i / STEPS),
                });
              }
            }
          } else {
            for (const [lon, lat] of coords) {
              segmentPath.push({ lat, lon });
            }
          }

          for (const point of segmentPath) {
            const last = fullPath[fullPath.length - 1];
            if (!samePoint(last, point)) {
              fullPath.push(point);
            }
          }

          const stopTargetIndex = segIndex;
          if (stopTargetIndex >= 0 && stopTargetIndex < stopsForPath.length) {
            const stopPoint = { lat: stopsForPath[stopTargetIndex].lat, lon: stopsForPath[stopTargetIndex].lon };
            const last = fullPath[fullPath.length - 1];
            if (!samePoint(last, stopPoint)) {
              fullPath.push(stopPoint);
            }
          }
        }

        if (fullPath.length > 2) {
          return fullPath;
        }
      }

      const fallbackStops = effectiveOrigin
        ? [
            { ...stopsForPath[0], lat: effectiveOrigin.lat, lon: effectiveOrigin.lon, id: '__dynamic_start__' },
            ...stopsForPath,
          ]
        : stopsForPath;

      return generateSimulationPath(fallbackStops);
    },
    [routeSegments, startPosition]
  );

  const toggleSim = useCallback(() => {
    setSimulationState((prev) => {
      if (prev.isRunning) {
        return { ...prev, isRunning: false };
      }

      if (!confirmedItinerary) return prev;

      const day = confirmedItinerary.plan[currentDayIndex];
      if (!day || day.stops.length === 0) return prev;

      const existingPath = simPathRef.current;
      const hasExistingPath = existingPath.length > 0;
      const endedExistingPath = hasExistingPath && prev.pathIndex >= existingPath.length - 1;
      const dayChanged = prev.currentDayIndex !== currentDayIndex;

      const needsFreshStart =
        !hasExistingPath || endedExistingPath || dayChanged || prev.userPosition === null;

      if (needsFreshStart) {
        const hasStartedDay = day.stops.some(
          (s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'in-progress'
        );

        if (!hasStartedDay && !prev.userPosition) {
          resetCurrentDayStatuses();
        }

        // Use persisted/current position as origin when available (covers page-reload resume)
        const origin = prev.userPosition ?? (hasStartedDay ? null : startPosition);
        const newPath = buildSimPath(day.stops, origin);
        const startIdx = prev.userPosition
          ? findClosestPathIndex(newPath, prev.userPosition)
          : 0;
        simPathRef.current = newPath;

        return {
          ...prev,
          isRunning: true,
          currentDayIndex,
          pathIndex: startIdx,
          elapsedAtStop: 0,
          userPosition: prev.userPosition || newPath[startIdx] || startPosition || null,
          simulationTime: prev.simulationTime ?? buildStartTime(tripFormData?.start_time),
        };
      }

      const safeIndex = Math.min(prev.pathIndex, existingPath.length - 1);
      return {
        ...prev,
        isRunning: true,
        currentDayIndex,
        userPosition: prev.userPosition || existingPath[safeIndex] || startPosition || null,
      };
    });
  }, [confirmedItinerary, currentDayIndex, buildSimPath, startPosition, resetCurrentDayStatuses]);

  const toggleAutoCheckIn = useCallback(() => {
    setSimulationState((prev) => ({ ...prev, autoCheckIn: !prev.autoCheckIn }));
  }, []);

  useEffect(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    if (!simulationState.isRunning || !confirmedItinerary) return;

    const TICK_MS = 200;

    simIntervalRef.current = setInterval(() => {
      const snap = simStateRef.current;
      const path = simPathRef.current;

      if (!snap.isRunning || path.length === 0) {
        setSimulationState((prev) => ({ ...prev, isRunning: false }));
        return;
      }

      const day = confirmedItinerary.plan[currentDayIndex];
      if (!day) {
        setSimulationState((prev) => ({ ...prev, isRunning: false }));
        return;
      }

      const activeStopIndex = day.stops.findIndex(
        (s) => s.status !== 'completed' && s.status !== 'skipped'
      );
      const activeStop = activeStopIndex >= 0 ? day.stops[activeStopIndex] : null;

      const POINTS_PER_TICK = Math.max(1, Math.floor(snap.speed));
      const nextIndex = Math.min(snap.pathIndex + POINTS_PER_TICK, path.length - 1);
      let newPos = path[nextIndex];

      if (activeStop) {
        const activeStopPos = { lat: activeStop.lat, lon: activeStop.lon };
        const distToActive = haversineDistance(newPos, activeStopPos);
        if (distToActive <= SNAP_TO_STOP_RADIUS_M) {
          newPos = activeStopPos;
        }
      }

      const isAtEnd = nextIndex >= path.length - 1;
      const newTime = new Date(snap.simulationTime.getTime() + TICK_MS * snap.speed * 60);

      const newActiveStopIndex = day.stops.findIndex(
        (s) => s.status !== 'completed' && s.status !== 'skipped'
      );

      // 9 pm warning — fire once per day when simulated time crosses 21:00
      // and there are still stops left to visit.
      if (
        newTime.getHours() >= 21 &&
        newActiveStopIndex !== -1 &&
        warned9pmDayRef.current !== currentDayIndex
      ) {
        warned9pmDayRef.current = currentDayIndex;
        const remaining = day.stops.filter(
          (s) => s.status !== 'completed' && s.status !== 'skipped'
        ).length;
        addNotification(
          'warning',
          `It's past 9 PM — you won't be able to cover the remaining ${remaining} stop${remaining !== 1 ? 's' : ''} today.`
        );
      }

      setSimulationState((prev) => ({
        ...prev,
        pathIndex: nextIndex,
        userPosition: newPos,
        simulationTime: newTime,
        isRunning: !isAtEnd,
        current_stop_index: newActiveStopIndex >= 0 ? newActiveStopIndex : prev.current_stop_index,
      }));

      if (snap.autoCheckIn) {
        setConfirmedItinerary((prev) => {
          if (!prev) return prev;
          const currentDay = prev.plan[currentDayIndex];
          if (!currentDay) return prev;

          let changed = false;

          const currentActiveStopIndex = currentDay.stops.findIndex(
            (s) => s.status !== 'completed' && s.status !== 'skipped'
          );

          if (currentActiveStopIndex === -1) return prev;

          const newStops = currentDay.stops.map((stop, index) => {
            if (stop.status === 'completed' || stop.status === 'skipped') return stop;
            if (index !== currentActiveStopIndex) return stop;

            const stopPos = { lat: stop.lat, lon: stop.lon };
            const dist = haversineDistance(newPos, stopPos);

            if (stop.status === 'in-progress') {
              if (dist > AUTO_CHECKOUT_RADIUS_M) {
                changed = true;
                return { ...stop, status: 'completed' as const };
              }
              return stop;
            }

            if (stop.status === 'pending' || stop.status === 'approaching') {
              if (dist <= AUTO_CHECKIN_RADIUS_M) {
                changed = true;
                return { ...stop, status: 'in-progress' as const };
              }

              if (dist <= APPROACH_RADIUS_M) {
                if (stop.status !== 'approaching') {
                  changed = true;
                  return { ...stop, status: 'approaching' as const };
                }
                return stop;
              }

              if (stop.status !== 'pending') {
                changed = true;
                return { ...stop, status: 'pending' as const };
              }

              return stop;
            }

            return stop;
          });

          if (!changed) return prev;

          return {
            ...prev,
            plan: prev.plan.map((d, i) =>
              i === currentDayIndex ? { ...d, stops: newStops } : d
            ),
          };
        });
      }

      if (isAtEnd) {
        setConfirmedItinerary((prev) => {
          if (!prev) return prev;

          const currentDay = prev.plan[currentDayIndex];
          if (!currentDay) return prev;

          let updatedPrev = prev;

          const finalActiveIndex = currentDay.stops.findIndex(
            (s) => s.status !== 'completed' && s.status !== 'skipped'
          );

          if (finalActiveIndex !== -1) {
            const finalActive = currentDay.stops[finalActiveIndex];
            const finalDist = haversineDistance(newPos, {
              lat: finalActive.lat,
              lon: finalActive.lon,
            });

            if (finalActive.status === 'in-progress' || finalDist <= AUTO_CHECKOUT_RADIUS_M) {
              updatedPrev = {
                ...prev,
                plan: prev.plan.map((d, i) =>
                  i === currentDayIndex
                    ? {
                        ...d,
                        stops: d.stops.map((s, idx) =>
                          idx === finalActiveIndex && s.status !== 'skipped'
                            ? { ...s, status: 'completed' as const }
                            : s
                        ),
                      }
                    : d
                ),
              };
            }
          }

          const updatedDay = updatedPrev.plan[currentDayIndex];
          const allDone = updatedDay.stops.every(
            (s) => s.status === 'completed' || s.status === 'skipped'
          );

          if (!allDone) return updatedPrev;

          const hasNextDay = currentDayIndex < updatedPrev.plan.length - 1;
          if (!hasNextDay) return updatedPrev;

          setTimeout(() => {
            const nextDayIndex = currentDayIndex + 1;

            addNotification(
              'success',
              `Day ${currentDayIndex + 1} completed! Moving to Day ${nextDayIndex + 1}.`
            );

            setCurrentDayIndex(nextDayIndex);
            setSimulationState((simPrev) => ({
              ...simPrev,
              currentDayIndex: nextDayIndex,
              pathIndex: 0,
              elapsedAtStop: 0,
              isRunning: false,
              userPosition: null,
              simulationTime: buildStartTime(tripFormDataRef.current?.start_time),
              current_stop_index: 0,
            }));
            simPathRef.current = [];
          }, 0);

          return updatedPrev;
        });
      }
    }, TICK_MS);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, [simulationState.isRunning, currentDayIndex, confirmedItinerary, addNotification]);

  const value = useMemo(
    () => ({
      itinerary: activeItinerary,
      draftItinerary,
      confirmedItinerary,
      tripFormData,
      currentDayIndex,
      simulationState,
      notifications,
      isGenerating,
      generationProgress,
      routeSegments,
      startPosition,
      isRoutingLoading,
      generateTrip,
      confirmTrip,
      clearDraftTrip,
      updateDraftItinerary,
      checkIn,
      skipStop,
      markDone,
      replan,
      applyStopsUpdate,
      nextDay,
      prevDay,
      goToDay,
      setSimSpeed,
      toggleSim,
      toggleAutoCheckIn,
      addNotification,
      dismissNotification,
    }),
    [
      draftItinerary,
      confirmedItinerary,
      tripFormData,
      currentDayIndex,
      simulationState,
      notifications,
      isGenerating,
      generationProgress,
      routeSegments,
      startPosition,
      isRoutingLoading,
      generateTrip,
      confirmTrip,
      clearDraftTrip,
      updateDraftItinerary,
      checkIn,
      skipStop,
      markDone,
      replan,
      applyStopsUpdate,
      nextDay,
      prevDay,
      goToDay,
      setSimSpeed,
      toggleSim,
      toggleAutoCheckIn,
      addNotification,
      dismissNotification,
      activeItinerary,
    ]
  );

  return <NomadContext.Provider value={value}>{children}</NomadContext.Provider>;
}

export function useNomad(): NomadContextType {
  const ctx = useContext(NomadContext);
  if (!ctx) throw new Error('useNomad must be used within NomadProvider');
  return ctx;
}