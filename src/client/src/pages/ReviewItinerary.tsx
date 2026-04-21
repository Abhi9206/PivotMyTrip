import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Compass,
  Clock3,
  Route,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useNomad } from '../contexts/NomadContext';
import { NomadMap } from '../components/NomadMap';
import { MidTripPanel } from '../components/MidTripPanel';
import { computeDayStats } from '../lib/apiService';
import type { Stop } from '../lib/types';

const HERO_BG =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';

function getStopStartTime(stop: Stop): string {
  return (
    (stop as any).planned_start ||
    (stop as any).arrive_time ||
    (stop as any).start_time ||
    (stop as any).visit_start ||
    (stop as any).scheduled_start ||
    (stop as any).time_start ||
    ''
  );
}

function getStopEndTime(stop: Stop): string {
  return (
    (stop as any).planned_end ||
    (stop as any).depart_time ||
    (stop as any).end_time ||
    (stop as any).visit_end ||
    (stop as any).scheduled_end ||
    (stop as any).time_end ||
    ''
  );
}

function formatTimeRange(stop: Stop) {
  const start = getStopStartTime(stop);
  const end = getStopEndTime(stop);

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (typeof (stop as any).time_slot === 'string' && (stop as any).time_slot.trim()) {
    return (stop as any).time_slot;
  }
  if (typeof (stop as any).visit_window === 'string' && (stop as any).visit_window.trim()) {
    return (stop as any).visit_window;
  }
  return 'Time not available';
}

export default function ReviewItinerary() {
  const [, navigate] = useLocation();
  const {
    draftItinerary,
    tripFormData,
    confirmTrip,
    goToDay,
    currentDayIndex,
    routeSegments,
    startPosition,
    isRoutingLoading,
    updateDraftItinerary,
    replan,
  } = useNomad();

  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [isMidTripOpen, setIsMidTripOpen] = useState(false);

  if (!draftItinerary) {
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
            <h2
              className="text-2xl font-semibold mb-3"
              style={{ color: '#2d2621' }}
            >
              No draft itinerary yet
            </h2>
            <p className="text-sm mb-6" style={{ color: '#6b6460' }}>
              Start from the planning page and generate your itinerary first.
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

  const day = draftItinerary.plan[currentDayIndex];
  if (!day) return null;

  const { totalDistanceKm, totalDurationHr } = computeDayStats(day.stops);

  const handleConfirm = () => {
    confirmTrip();
    navigate('/live');
  };

  const toggleDetails = (stopId: string) => {
    setExpandedStopId(prev => (prev === stopId ? null : stopId));
  };

  const handleMidTripApply = (
    updatedStops: Stop[],
    totalDistM: number,
    totalDurMin: number
  ) => {
    updateDraftItinerary(currentDayIndex, updatedStops, totalDistM, totalDurMin);
  };

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
              onClick={() => navigate('/plan')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: '#6b6460' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ebe8e4')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                      Review before going live
                    </span>
                  </div>

                  <h1
                    className="font-display text-3xl md:text-4xl font-bold mb-1"
                    style={{ color: '#2d2621' }}
                  >
                    Review Your Itinerary
                  </h1>

                  <p className="text-sm md:text-base" style={{ color: '#6b6460' }}>
                    Check each day, preview the map, refine with AI, and confirm when ready.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 min-w-[180px]">
                  <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{ backgroundColor: '#fffdfb', borderColor: '#e3ddd5' }}
                  >
                    <Route className="w-4 h-4 mx-auto mb-1" style={{ color: '#C85A2A' }} />
                    <p className="text-xs font-semibold" style={{ color: '#2d2621' }}>
                      Day Review
                    </p>
                  </div>

                  <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{ backgroundColor: '#fffdfb', borderColor: '#e3ddd5' }}
                  >
                    <MapPin className="w-4 h-4 mx-auto mb-1" style={{ color: '#1B4332' }} />
                    <p className="text-xs font-semibold" style={{ color: '#2d2621' }}>
                      Map Preview
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-3xl border shadow-sm p-5 md:p-6 mb-4"
              style={{
                backgroundColor: 'rgba(255,253,251,0.92)',
                borderColor: '#e3ddd5',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-5 items-center">
                <div className="min-w-0">
                  <h2
                    className="text-2xl md:text-[30px] font-bold tracking-tight"
                    style={{ color: '#2d2621' }}
                  >
                    {draftItinerary.destination}
                  </h2>

                  <p
                    className="text-sm md:text-base mt-1"
                    style={{ color: '#6b6460' }}
                  >
                    {draftItinerary.days} days planned
                    {tripFormData?.start_location && ` · Start: ${tripFormData.start_location}`}
                  </p>
                </div>

                <div className="flex flex-wrap justify-start lg:justify-center gap-2">
                  {draftItinerary.plan.map((d, i) => (
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

                <div className="flex flex-wrap justify-start lg:justify-end gap-3">
                  <button
                      onClick={replan}
                      className="px-6 py-3.5 rounded-2xl font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap"
                      style={{
                        backgroundColor: '#fdf9f7',
                        color: '#6b6460',
                        border: '1px solid #ddd9d0',
                      }}
                  >
                    <RotateCcw className="w-4 h-4"/>
                    Optimize
                  </button>

                  <button
                      onClick={handleConfirm}
                      className="px-6 py-3.5 rounded-2xl font-semibold text-white flex items-center gap-2 shadow-sm whitespace-nowrap"
                      style={{
                        background: 'linear-gradient(135deg, #1B4332 0%, #24543f 100%)',
                      }}
                  >
                    <CheckCircle className="w-4 h-4"/>
                    Confirm Trip
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
              <div className="xl:col-span-7">
                <div
                    className="rounded-3xl border shadow-sm p-5 md:p-6"
                    style={{
                      backgroundColor: 'rgba(255,253,251,0.92)',
                      borderColor: '#e3ddd5',
                      backdropFilter: 'blur(6px)',
                    }}
                >
                  <h3 className="text-lg font-semibold mb-1" style={{color: '#2d2621'}}>
                    Day {day.day} Itinerary
                  </h3>
                  <p className="text-sm mb-5" style={{color: '#6b6460'}}>
                  Review timing, stop order, and details before you start live tracking.
                  </p>

                  <div className="space-y-4">
                    {day.stops.map((stop, index) => {
                      const expanded = expandedStopId === stop.id;

                      return (
                        <div
                          key={stop.id}
                          className="rounded-3xl border p-4"
                          style={{
                            backgroundColor: '#fffdfb',
                            borderColor: '#ddd9d0',
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-1"
                              style={{ backgroundColor: '#C85A2A' }}
                            >
                              {index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div
                                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold mb-2"
                                    style={{
                                      backgroundColor: 'rgba(200,90,42,0.12)',
                                      color: '#C85A2A',
                                    }}
                                  >
                                    {stop.category?.toUpperCase() || 'PLACE'}
                                  </div>

                                  <h4
                                    className="font-semibold text-lg leading-snug"
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
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              <div
                                className="flex flex-wrap items-center gap-4 text-sm mt-3"
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
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-5">
                <div className="sticky top-4 space-y-4">
                  <div
                    className="rounded-3xl border p-5 shadow-sm"
                    style={{
                      backgroundColor: 'rgba(255,253,251,0.92)',
                      borderColor: '#e3ddd5',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(200,90,42,0.12)' }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: '#C85A2A' }} />
                      </div>

                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#2d2621' }}>
                          Edit Itinerary
                        </p>
                        <p className="text-xs" style={{ color: '#6b6460' }}>
                          Adjust stops, timing, or route before you confirm.
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => setIsMidTripOpen(true)}
                        className="px-7 py-4 rounded-2xl text-base font-semibold text-white flex items-center gap-2 transition-all shadow-sm"
                        style={{
                          background: 'linear-gradient(135deg, #C85A2A 0%, #d06a39 100%)',
                        }}
                      >
                        <Sparkles className="w-4 h-4" />
                        Open Editor
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {['Add Stop', 'Replace Stop', 'Remove Stop'].map((action) => (
                        <span
                          key={action}
                          className="px-3 py-1 rounded-full text-xs font-medium cursor-default"
                          style={{
                            backgroundColor: '#f3eee8',
                            color: '#6b6460',
                            border: '1px solid #ddd9d0',
                          }}
                        >
                          {action}
                        </span>
                      ))}
                    </div>

                    <p className="text-[11px] mt-3" style={{ color: '#8b817b' }}>
                      Changes apply before you start live tracking.
                    </p>
                  </div>

                  <div
                    className="rounded-3xl border shadow-sm p-5"
                    style={{
                      backgroundColor: 'rgba(255,253,251,0.92)',
                      borderColor: '#e3ddd5',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: '#2d2621' }}>
                          Day {day.day} Map Preview
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

                    <div
                      className="rounded-2xl overflow-hidden border"
                      style={{ borderColor: '#ddd9d0', height: '500px' }}
                    >
                      <NomadMap
  key={day.stops.map(s => s.id).join('-')}   // 🔥 FORCE RE-RENDER
  stops={day.stops}
  userPosition={null}
  routeSegments={routeSegments}
  startPosition={startPosition}
  isFullscreen={false}
  isRoutingLoading={isRoutingLoading}
/>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <MidTripPanel
  isOpen={isMidTripOpen}
  onClose={() => setIsMidTripOpen(false)}
  stops={day.stops}
  destination={draftItinerary.destination}
  dayNum={day.day}
  interests={tripFormData?.interests ?? []}
  pace={tripFormData?.pace ?? 'balanced'}
  startTime={tripFormData?.start_time || '09:00'}
  transportMode={tripFormData?.transport_mode || 'walking'}
  onApply={handleMidTripApply}
/>
    </div>
  );
}