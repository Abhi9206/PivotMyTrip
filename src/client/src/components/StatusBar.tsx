import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, MapPin, Clock, CheckCircle, PauseCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { findActiveStop } from '../lib/simulationEngine';
import { formatDistance } from '../lib/utils';
import { useNomad } from '../contexts/NomadContext';

/** Parse "HH:MM" into a Date on the same calendar day as refDate */
function parseTimeOnDay(timeStr: string, refDate: Date): Date {
  const parts = timeStr.split(':');
  if (parts.length < 2) return refDate;
  const d = new Date(refDate);
  d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  return d;
}

export function StatusBar() {
  const { itinerary, currentDayIndex, simulationState, replan } = useNomad();

  if (!itinerary) return null;

  const day = itinerary.plan[currentDayIndex];
  if (!day) return null;

  const stops = day.stops;
  const activeStop = findActiveStop(stops);
  const completedCount = stops.filter(s => s.status === 'completed').length;
  const totalCount = stops.length;
  const allDone = completedCount === totalCount;
  const nextPending = stops.find(s => s.status === 'pending' || s.status === 'approaching');
  const simTime = simulationState.simulationTime;

  const timeStr = simTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  /* ── Status text + color ── */
  let statusText = '';
  let statusHex  = '#6b6460';
  let StatusIcon = Clock;

  if (allDone) {
    statusText = 'All done! Great day!';
    statusHex  = '#1B4332';
    StatusIcon = CheckCircle;
  } else if (!simulationState.isRunning) {
    statusText = activeStop ? `Paused at ${activeStop.name}` : 'Simulation paused';
    StatusIcon = PauseCircle;
  } else if (activeStop?.status === 'in-progress') {
    statusText = `Visiting ${activeStop.name}`;
    statusHex  = '#C85A2A';
    StatusIcon = MapPin;
  } else if (activeStop?.status === 'approaching') {
    statusText = `Approaching ${activeStop.name}`;
    statusHex  = '#b86a14';
    StatusIcon = Navigation;
  } else if (nextPending) {
    statusText = `Traveling to ${nextPending.name}`;
    statusHex  = '#1d3d7b';
    StatusIcon = Navigation;
  }

  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // ── Overstay / understay detection ────────────────────────────────────────
  // Overstay: in-progress stop whose planned_end is in the past
  const overstayStop = activeStop?.status === 'in-progress' && activeStop.planned_end && simulationState.isRunning
    ? (parseTimeOnDay(activeStop.planned_end, simTime) < simTime ? activeStop : null)
    : null;

  // Understay: no active stop but next pending stop's planned_start has already passed
  const understayStop = !activeStop && nextPending?.planned_start && simulationState.isRunning
    ? (parseTimeOnDay(nextPending.planned_start, simTime) < simTime ? nextPending : null)
    : null;

  const stayAlert = overstayStop
    ? { stop: overstayStop, type: 'overstay' as const, msg: `Running late at ${overstayStop.name} — planned end passed` }
    : understayStop
    ? { stop: understayStop, type: 'understay' as const, msg: `Behind schedule — ${understayStop.name} should have started` }
    : null;

  return (
    <div style={{ backgroundColor: '#fdf9f7', borderColor: '#ddd9d0' }} className="border-b flex-shrink-0">
      <div className="flex items-center gap-4 text-sm px-4 py-2.5">
        {/* Sim time */}
        <div className="flex items-center gap-1.5 min-w-[80px]" style={{ color: '#6b6460' }}>
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono-data text-xs">{timeStr}</span>
        </div>

        {/* Status */}
        <AnimatePresence mode="wait">
          <motion.div
            key={statusText}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-1.5 flex-1"
            style={{ color: statusHex }}
          >
            <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{statusText}</span>
          </motion.div>
        </AnimatePresence>

        {/* Progress */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-xs font-mono-data" style={{ color: '#6b6460' }}>
            <span className="font-semibold" style={{ color: '#2d2621' }}>{completedCount}</span>/{totalCount}
          </div>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#ebe8e4' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#1B4332' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Distance to next */}
        {activeStop && nextPending && nextPending.distance_from_user !== undefined && (
          <div className="text-xs hidden md:flex items-center gap-1" style={{ color: '#6b6460' }}>
            <Navigation className="w-3 h-3" />
            {formatDistance(nextPending.distance_from_user)}
          </div>
        )}
      </div>

      {/* ── Stay-time alert banner ── */}
      <AnimatePresence>
        {stayAlert && (
          <motion.div
            key={stayAlert.type}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-2 text-xs"
            style={{
              backgroundColor: stayAlert.type === 'overstay' ? '#fff3cd' : '#fce4d6',
              borderTop: `1px solid ${stayAlert.type === 'overstay' ? '#ffc107' : '#f97316'}`,
              color: stayAlert.type === 'overstay' ? '#856404' : '#c2410c',
            }}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 font-medium truncate">{stayAlert.msg}</span>
            <button
              onClick={replan}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{ backgroundColor: stayAlert.type === 'overstay' ? '#856404' : '#c2410c', color: 'white' }}
            >
              <RotateCcw className="w-3 h-3" />
              Replan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
