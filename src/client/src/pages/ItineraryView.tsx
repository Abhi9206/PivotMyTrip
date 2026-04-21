import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  RotateCcw,
  Globe,
  AlertTriangle,
  Sparkles,
  MapPin,
  Compass,
  Clock3,
  Route,
  Navigation,
  CheckCircle2,
  CheckSquare,
} from 'lucide-react';
import { useNomad } from '../contexts/NomadContext';
import { NomadMap } from '../components/NomadMap';
import { StatusBar } from '../components/StatusBar';
import { MidTripPanel } from '../components/MidTripPanel';
import { computeDayStats } from '../lib/apiService';
import { categoryEmoji } from '../lib/utils';
import type { Stop } from '../lib/types';

const SPEED_OPTIONS = [1, 2, 5, 10];

const HERO_BG =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';

function getStopStartTime(stop: any): string {
  return (
    stop.planned_start ||
    stop.arrive_time ||
    stop.start_time ||
    stop.visit_start ||
    stop.scheduled_start ||
    stop.time_start ||
    stop.start ||
    ''
  );
}

function getStopEndTime(stop: any): string {
  return (
    stop.planned_end ||
    stop.depart_time ||
    stop.end_time ||
    stop.visit_end ||
    stop.scheduled_end ||
    stop.time_end ||
    stop.end ||
    ''
  );
}

function formatTimeRange(stop: any) {
  const start = getStopStartTime(stop);
  const end = getStopEndTime(stop);

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (typeof stop.time_slot === 'string' && stop.time_slot.trim()) return stop.time_slot;
  if (typeof stop.visit_window === 'string' && stop.visit_window.trim()) return stop.visit_window;
  return 'Time not available';
}

function getCategoryStyles(category?: string) {
  const c = (category || '').toLowerCase();

  if (c.includes('art')) {
    return {
      badgeBg: 'rgba(139,92,246,0.12)',
      badgeColor: '#8b5cf6',
      numberBg: '#8b5cf6',
    };
  }

  if (c.includes('nature') || c.includes('park') || c.includes('garden')) {
    return {
      badgeBg: 'rgba(34,197,94,0.12)',
      badgeColor: '#16a34a',
      numberBg: '#16a34a',
    };
  }

  return {
    badgeBg: 'rgba(200,90,42,0.12)',
    badgeColor: '#C85A2A',
    numberBg: '#C85A2A',
  };
}

export default function ItineraryView() {
  const [, navigate] = useLocation();
  const {
    confirmedItinerary,
    tripFormData,
    currentDayIndex,
    simulationState,
    routeSegments,
    startPosition,
    nextDay,
    prevDay,
    goToDay,
    toggleSim,
    setSimSpeed,
    checkIn,
    markDone,
    skipStop,
    applyStopsUpdate,
    isRoutingLoading,
  } = useNomad();

  const [isMidTripOpen, setIsMidTripOpen] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [showDoneSection, setShowDoneSection] = useState(true);

  if (!confirmedItinerary) {
    return (
      <div
        className="min-h-screen relative overflow-hidden"
        style={{ backgroundColor: '#f5f3f0' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            opacity: 0.55,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(rgba(245,243,240,0.38), rgba(245,243,240,0.42))',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at top left, rgba(200,90,42,0.06), transparent 24%), radial-gradient(circle at top right, rgba(27,67,50,0.06), transparent 28%)',
          }}
        />

        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div
            className="rounded-3xl border shadow-sm p-8 max-w-lg w-full text-center"
            style={{
              backgroundColor: 'rgba(255,253,251,0.92)',
              borderColor: '#e3ddd5',
              backdropFilter: 'blur(6px)',
            }}
          >
            <h2 className="text-2xl font-semibold mb-3" style={{ color: '#2d2621' }}>
              No itinerary yet
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6b6460' }}>
              Start from the planning page and confirm your trip first.
            </p>
            <button
              onClick={() => navigate('/plan')}
              className="px-6 py-3 rounded-2xl font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #1B4332 0%, #24543f 100%)',
              }}
            >
              Go to Planning
            </button>
          </div>
        </div>
      </div>
    );
  }

  const day = confirmedItinerary.plan[currentDayIndex];
  if (!day) return null;

  const { totalDistanceKm, totalDurationHr } = computeDayStats(day.stops);
  const hasFallback = day.stops.some((s) => s.route_is_fallback);
  const completedStops = day.stops.filter((s) => s.status === 'completed').length;

  const categoryBreakdown: Record<string, number> = {};
  day.stops.forEach((s) => {
    categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;
  });

  const handleMidTripApply = (
    updatedStops: Stop[],
    totalDistM: number,
    totalDurMin: number
  ) => {
    applyStopsUpdate(currentDayIndex, updatedStops, totalDistM, totalDurMin);
  };

  const toggleDetails = (stopId: string) => {
    setExpandedStopId((prev) => (prev === stopId ? null : stopId));
  };
const getStopButtonState = (stop: Stop) => {
  if (stop.status === 'approaching') {
  return {
    label: 'Moving Towards',
    bg: '#C85A2A',
    disabled: true,
    icon: <Navigation className="w-4 h-4" />,
  };
}

  if (stop.status === 'in-progress') {
    return {
      label: 'Checked In',
      bg: '#2d6a4f',
      disabled: true,
      icon: <CheckCircle2 className="w-4 h-4" />,
    };
  }

  return {
    label: 'Check In',
    bg: '#1B4332',
    disabled: false,
    icon: <Navigation className="w-4 h-4" />,
  };
};


  // Separate active stops from completed ones
  const activeStops = day.stops.filter(
  (s) => s.status === 'pending' || s.status === 'approaching' || s.status === 'in-progress'
);
  const doneStops = day.stops.filter((s) => s.status === 'completed');

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: '#f5f3f0' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          opacity: 0.55,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(rgba(245,243,240,0.38), rgba(245,243,240,0.42))',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(200,90,42,0.06), transparent 24%), radial-gradient(circle at top right, rgba(27,67,50,0.06), transparent 28%)',
        }}
      />

      <div className="relative z-10">
        <div className="max-w-[1700px] mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => navigate('/review')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: '#6b6460' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ebe8e4')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2 ml-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: '#1B4332' }}
              >
                <MapPin className="w-4 h-4 text-white" />
              </div>

              <span
                className="font-display text-xl font-semibold"
                style={{ color: '#2d2621' }}
              >
                PivotMyTrip
              </span>

              <span
                className="hidden md:block text-sm italic"
                style={{ color: '#1B4332' }}
              >
                ✨ Plans change. Your trip can too.
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div
              className="rounded-3xl border px-5 md:px-6 py-5 mb-4 shadow-sm"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,253,251,0.96) 0%, rgba(237,233,224,0.95) 100%)',
                borderColor: '#e3ddd5',
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: 'rgba(27,67,50,0.10)',
                        color: '#1B4332',
                      }}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Live trip in progress
                    </span>
                  </div>

                  <h1
                    className="font-display text-3xl md:text-4xl font-bold mb-1"
                    style={{ color: '#2d2621' }}
                  >
                    Track Your Trip
                  </h1>

                  <p className="text-sm md:text-base" style={{ color: '#6b6460' }}>
                    Follow your route, manage stops, and make live updates as you go.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 min-w-[250px]">
                  <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{ backgroundColor: '#fffdfb', borderColor: '#e3ddd5' }}
                  >
                    <MapPin className="w-4 h-4 mx-auto mb-1" style={{ color: '#1B4332' }} />
                    <p className="text-xs font-semibold" style={{ color: '#2d2621' }}>
                      Live Route
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{ backgroundColor: '#fffdfb', borderColor: '#e3ddd5' }}
                  >
                    <CheckSquare
                      className="w-4 h-4 mx-auto mb-1"
                      style={{ color: '#C85A2A' }}
                    />
                    <p className="text-xs font-semibold" style={{ color: '#2d2621' }}>
                      Progress
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{ backgroundColor: '#fffdfb', borderColor: '#e3ddd5' }}
                  >
                    <Sparkles className="w-4 h-4 mx-auto mb-1" style={{ color: '#8b5cf6' }} />
                    <p className="text-xs font-semibold" style={{ color: '#2d2621' }}>
                      Mid Trip Plans
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-3xl border shadow-sm px-5 md:px-6 py-4 mb-4"
              style={{
                backgroundColor: 'rgba(255,253,251,0.92)',
                borderColor: '#e3ddd5',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="min-w-0">
                  <h2
                      className="text-xl md:text-2xl font-bold tracking-tight"
                      style={{color: '#2d2621'}}
                  >
                    {confirmedItinerary.destination}
                  </h2>

                  <p className="text-sm mt-1" style={{color: '#6b6460'}}>
                    {confirmedItinerary.days} days planned
                    {tripFormData?.start_location && ` · Start: ${tripFormData.start_location}`}
                    {tripFormData?.transport_mode && ` · ${tripFormData.transport_mode}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3 lg:mr-12">
                  <button
                      onClick={() => setIsMidTripOpen(true)}
                      className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
                      style={{
                        backgroundColor: '#C85A2A',
                        color: '#ffffff',
                        boxShadow: '0 6px 16px rgba(200,90,42,0.22)',
                        border: '1px solid rgba(200,90,42,0.18)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#b94f22';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#C85A2A';
                      }}
                  >
                    <Sparkles className="w-4 h-4"/>
                    Mid Trip Plans
                  </button>

                  <button
                      onClick={() => setIsMapFullscreen((prev) => !prev)}
                      className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                      style={{
                        backgroundColor: '#f4ebe5',
                        color: '#C85A2A',
                        border: '1px solid rgba(200,90,42,0.25)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#efe1d9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f4ebe5';
                      }}
                  >
                    {isMapFullscreen ? 'Exit Map' : 'Expand Map'}
                  </button>

                  {confirmedItinerary.plan.map((d, i) => (
                      <button
                          key={d.day}
                          onClick={() => goToDay(i)}
                          className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                          style={
                            i === currentDayIndex
                                ? {
                                  backgroundColor: '#1B4332',
                                  color: '#ffffff',
                                  boxShadow: '0 6px 16px rgba(27,67,50,0.18)',
                                }
                                : {
                                  backgroundColor: '#f8f4ef',
                                  color: '#2d2621',
                                  border: '1px solid #ddd9d0',
                                }
                          }
                          onMouseEnter={(e) => {
                            if (i !== currentDayIndex) {
                              e.currentTarget.style.backgroundColor = '#f1ece6';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (i !== currentDayIndex) {
                              e.currentTarget.style.backgroundColor = '#f8f4ef';
                            }
                          }}
                      >
                        Day {d.day}
                      </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <StatusBar/>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              {!isMapFullscreen && (
                  <div className="xl:col-span-2">
                    <div className="sticky top-4 space-y-4">
                      <div
                          className="rounded-3xl border shadow-sm p-4"
                          style={{
                            backgroundColor: 'rgba(255,253,251,0.92)',
                            borderColor: '#e3ddd5',
                            backdropFilter: 'blur(6px)',
                          }}
                      >
                        <p
                            className="text-sm font-bold uppercase tracking-wider mb-3"
                            style={{color: '#2d2621'}}
                        >
                          Today's Stops Detail
                        </p>

                        <div className="space-y-3">
                          <div
                              className="rounded-2xl px-4 py-3"
                              style={{backgroundColor: '#f7f2ed'}}
                          >
                            <p className="text-xs mb-1" style={{color: '#6b6460'}}>
                              Stops
                            </p>
                            <p className="font-semibold text-lg" style={{color: '#2d2621'}}>
                              {day.stops.length}
                            </p>
                          </div>

                          <div
                              className="rounded-2xl px-4 py-3"
                              style={{backgroundColor: '#f7f2ed'}}
                          >
                            <p className="text-xs mb-1" style={{color: '#6b6460'}}>
                              Done
                            </p>
                            <p className="font-semibold text-lg" style={{color: '#2d2621'}}>
                              {completedStops}
                            </p>
                          </div>

                          <div
                              className="rounded-2xl px-4 py-3"
                              style={{backgroundColor: '#f7f2ed'}}
                          >
                            <p className="text-xs mb-1" style={{color: '#6b6460'}}>
                              Distance
                            </p>
                            <p className="font-semibold text-lg" style={{color: '#2d2621'}}>
                              {totalDistanceKm} km
                            </p>
                          </div>

                          <div
                              className="rounded-2xl px-4 py-3"
                              style={{backgroundColor: '#f7f2ed'}}
                          >
                          <p className="text-xs mb-1" style={{ color: '#6b6460' }}>
                            Duration
                          </p>
                          <p className="font-semibold text-lg" style={{ color: '#2d2621' }}>
                            {totalDurationHr}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-3xl border shadow-sm p-5"
                      style={{
                        backgroundColor: 'rgba(255,253,251,0.92)',
                        borderColor: '#e3ddd5',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      <p
                        className="text-sm font-bold uppercase tracking-wider mb-3"
                        style={{ color: '#2d2621' }}
                      >
                        Categories
                      </p>

                      <div className="space-y-2">
                        {Object.entries(categoryBreakdown).map(([cat, count]) => (
                          <div key={cat} className="flex items-center justify-between text-sm">
                            <span style={{ color: '#2d2621' }}>
                              {categoryEmoji(cat)} {cat}
                            </span>
                            <span style={{ color: '#6b6460' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {hasFallback && (
                      <div
                        className="rounded-3xl border shadow-sm p-4"
                        style={{
                          backgroundColor: 'rgba(255,253,251,0.92)',
                          borderColor: '#e3ddd5',
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: '#C85A2A' }} />
                          <p className="text-xs" style={{ color: '#6b6460' }}>
                            Some distances are estimated because road data was unavailable for part
                            of the route.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={isMapFullscreen ? 'fixed inset-0 z-[2000] p-0' : 'xl:col-span-7'}>
                {isMapFullscreen && (
                  <button
                    onClick={() => setIsMapFullscreen(false)}
                    className="absolute top-3 right-3 z-[2100] text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: 'rgba(45,38,33,0.88)',
                      color: 'white',
                    }}
                  >
                    Exit Fullscreen
                  </button>
                )}

                <div className="space-y-4">
                  {!isMapFullscreen && (
                    <div
                      className="rounded-3xl border shadow-sm p-5 md:p-6"
                      style={{
                        backgroundColor: 'rgba(255,253,251,0.92)',
                        borderColor: '#e3ddd5',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-l" style={{ color: '#2d2621' }}>
                            Live Simulation
                          </p>
                          <p className="text-xs" style={{ color: '#6b6460' }}>
                            Simulation, optimization, and live trip actions.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={prevDay}
                            disabled={currentDayIndex === 0}
                            className="p-2 rounded-xl disabled:opacity-40"
                            style={{
                              backgroundColor: '#fdf9f7',
                              color: '#6b6460',
                              border: '1px solid #ddd9d0',
                            }}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <span className="text-sm px-2" style={{ color: '#6b6460' }}>
                            Day {day.day}
                          </span>

                          <button
                            onClick={nextDay}
                            disabled={currentDayIndex === confirmedItinerary.plan.length - 1}
                            className="p-2 rounded-xl disabled:opacity-40"
                            style={{
                              backgroundColor: '#fdf9f7',
                              color: '#6b6460',
                              border: '1px solid #ddd9d0',
                            }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={toggleSim}
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium"
                          style={
                            simulationState.isRunning
                              ? {
                                  backgroundColor: 'rgba(200,90,42,0.12)',
                                  color: '#C85A2A',
                                  border: '1px solid rgba(200,90,42,0.25)',
                                }
                              : {
                                  backgroundColor: 'rgba(27,67,50,0.10)',
                                  color: '#1B4332',
                                  border: '1px solid rgba(27,67,50,0.20)',
                                }
                          }
                        >
                          {simulationState.isRunning ? (
                            <>
                              <Pause className="w-4 h-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Simulate
                            </>
                          )}
                        </motion.button>

                        <div
                          className="flex items-center gap-1 rounded-2xl p-1"
                          style={{ backgroundColor: '#f7f2ed' }}
                        >
                          {SPEED_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setSimSpeed(s)}
                              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                              style={
                                simulationState.speed === s
                                  ? {
                                      backgroundColor: '#1B4332',
                                      color: 'white',
                                    }
                                  : {
                                      color: '#6b6460',
                                    }
                              }
                            >
                              {s}x
                            </button>
                          ))}
                        </div>

                      </div>
                    </div>
                  )}

                  <div
                    className={`rounded-3xl border shadow-sm p-5 ${isMapFullscreen ? 'h-full rounded-none border-none' : ''}`}
                    style={{
                      backgroundColor: isMapFullscreen ? '#fffdfb' : 'rgba(255,253,251,0.92)',
                      borderColor: '#e3ddd5',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    {!isMapFullscreen && (
                      <div className="flex items-center justify-between gap-4 mb-0.5">
                        <div>
                          <h3 className="text-lg font-semibold" style={{ color: '#2d2621' }}>
                            Live Map
                          </h3>
                          <p className="text-sm" style={{ color: '#6b6460' }}>
                            {day.theme}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <div
                            className="rounded-2xl px-4 py-3"
                            style={{ backgroundColor: '#f7f2ed' }}
                          >
                            <p className="text-xs mb-1" style={{ color: '#6b6460' }}>
                              Distance
                            </p>
                            <p className="font-semibold" style={{ color: '#2d2621' }}>
                              {totalDistanceKm} km
                            </p>
                          </div>

                          <div
                            className="rounded-2xl px-4 py-3"
                            style={{ backgroundColor: '#f7f2ed' }}
                          >
                            <p className="text-xs mb-1" style={{ color: '#6b6460' }}>
                              Duration
                            </p>
                            <p className="font-semibold" style={{ color: '#2d2621' }}>
                              {totalDurationHr}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={isMapFullscreen ? 'h-[calc(100vh-40px)]' : 'h-[720px]'}>
                      <NomadMap
                        key={`map-${day.stops.map((s) => s.id).join('-')}-${isMapFullscreen}`}
                        stops={day.stops}
                        userPosition={simulationState.userPosition}
                        routeSegments={routeSegments}
                        startPosition={startPosition}
                        isFullscreen={isMapFullscreen}
                        isRoutingLoading={isRoutingLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!isMapFullscreen && (
                <div className="xl:col-span-3">
                  <div className="sticky top-4 space-y-4">

                    <div
                      className="rounded-3xl border shadow-sm p-5 md:p-6"
                      style={{
                        backgroundColor: 'rgba(255,253,251,0.92)',
                        borderColor: '#e3ddd5',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold" style={{ color: '#2d2621' }}>
                            Day {day.day} Itinerary
                          </h3>
                          <p className="text-sm" style={{ color: '#6b6460' }}>
                            Live tracking and stop actions.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[880px] overflow-y-auto pr-1">
                        {/* ── Active stops ── */}
                        {activeStops.map((stop) => {
  const expanded = expandedStopId === stop.id;
  const styles = getCategoryStyles(stop.category);
  const isInProgress = stop.status === 'in-progress';
  const isApproaching = stop.status === 'approaching';
  const isSkipped = stop.status === 'skipped';
  const visNum = stop.visit_order ?? (day.stops.indexOf(stop) + 1);
  const buttonState = getStopButtonState(stop);

                          return (
                            <motion.div
                              key={stop.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="rounded-2xl border p-1"
                              style={{
                                backgroundColor: isInProgress
                                  ? 'rgba(27,67,50,0.05)'
                                  : isApproaching
                                  ? 'rgba(200,90,42,0.04)'
                                  : '#fffdfb',
                                borderColor: isInProgress
                                  ? 'rgba(27,67,50,0.25)'
                                  : isApproaching
                                  ? 'rgba(200,90,42,0.25)'
                                  : '#ddd9d0',
                                opacity: isSkipped ? 0.55 : 1,
                              }}
                            >
                              <div className="flex items-start gap-4">
                                <div
                                  className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-1"
                                  style={{ backgroundColor: styles.numberBg }}
                                >
                                  {visNum}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <div
                                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                                          style={{
                                            backgroundColor: styles.badgeBg,
                                            color: styles.badgeColor,
                                          }}
                                        >
                                          {stop.category?.toUpperCase() || 'PLACE'}
                                        </div>

                                        {isSkipped && (
                                          <span
                                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                            style={{
                                              backgroundColor: 'rgba(107,100,96,0.12)',
                                              color: '#6b6460',
                                            }}
                                          >
                                            ⤼ Skipped
                                          </span>
                                        )}
                                      </div>

                                      <h4
                                        className="font-semibold text-s leading-snug"
                                        style={{ color: '#2d2621' }}
                                      >
                                        {stop.name}
                                      </h4>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => toggleDetails(stop.id)}
                                      className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                                      style={{
                                        borderColor: '#ddd9d0',
                                        backgroundColor: '#fdf9f7',
                                        color: '#6b6460',
                                      }}
                                    >
                                      {expanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRightSmall className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>

                                  <div
                                    className="flex flex-wrap items-center gap-3 text-sm mt-1.5"
                                    style={{ color: '#6b6460' }}
                                  >
                                    <span className="flex items-center gap-1">
                                      <Clock3 className="w-4 h-4" />
                                      {formatTimeRange(stop)}
                                    </span>

                                    <span className="flex items-center gap-1">
                                      <Route className="w-4 h-4" />
                                      {(stop as any).duration_min
                                        ? `${(stop as any).duration_min} min`
                                        : 'Duration not set'}
                                    </span>
                                  </div>

                                  <AnimatePresence>
                                    {expanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div
                                          className="mt-4 pt-4 border-t text-sm leading-7"
                                          style={{
                                            borderColor: '#ebe8e4',
                                            color: '#6b6460',
                                          }}
                                        >
                                          {stop.description ||
                                            'No detailed description available for this stop yet.'}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  <div
                                    className="mt-2 pt-2 border-t"
                                    style={{ borderColor: '#ebe8e4' }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <button
                                          onClick={() => {
                                            if (!buttonState.disabled) {
                                              checkIn(stop.id);
                                            }
                                          }}
                                          disabled={buttonState.disabled}
                                          className="w-full h-8 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-default"
                                          style={{backgroundColor: buttonState.bg}}
                                      >
                                        {buttonState.icon}
                                        {buttonState.label}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                        {activeStops.length === 0 && doneStops.length === 0 && (
                            <div className="text-center py-16" style={{ color: '#6b6460' }}>
                            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No stops for this day</p>
                          </div>
                        )}

                        {activeStops.length === 0 && doneStops.length > 0 && (
                          <div className="text-center py-8" style={{ color: '#6b6460' }}>
                            <CheckCircle2
  className="w-14 h-14 mx-auto mb-3"
  style={{
    color: '#16a34a',   // bright green
    strokeWidth: 3      // bold icon
  }}
/>

<p
  className="text-lg font-bold text-center"
  style={{ color: '#16a34a' }}
>
  All Stops Completed!
</p>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <MidTripPanel
        isOpen={isMidTripOpen}
        onClose={() => setIsMidTripOpen(false)}
        stops={day.stops}
        destination={confirmedItinerary.destination}
        dayNum={day.day}
        interests={tripFormData?.interests ?? []}
        pace={tripFormData?.pace ?? 'balanced'}
        startTime={tripFormData?.start_time}
        transportMode={tripFormData?.transport_mode}
        currentPosition={simulationState.userPosition}
        currentSimTime={simulationState.simulationTime}
        onApply={handleMidTripApply}
      />
    </div>
  );
}