// NomadAI StopCard — Organic Expedition Theme (matching WanderAI LocationCard)
// Light off-white card · timeline dot · terracotta active · forest green visited
// DM Sans body · JetBrains Mono times

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Navigation, CheckCircle, SkipForward, AlertTriangle, Timer } from 'lucide-react';
import { categoryEmoji, formatDistance, formatDuration } from '../lib/utils';
import { getCategoryColor } from '../lib/simulationEngine';
import type { Stop } from '../lib/types';

interface StopCardProps {
  stop: Stop;
  index: number;
  onCheckIn: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSkip:     (id: string) => void;
}

export const StopCard = forwardRef<HTMLDivElement, StopCardProps>(
  function StopCard({ stop, index, onCheckIn, onMarkDone, onSkip }, ref) {
  const categoryColor = getCategoryColor(stop.category);
  const isVisited   = stop.status === 'completed';
  const isSkipped   = stop.status === 'skipped';
  const isActive    = stop.status === 'in-progress';
  const isNear      = stop.status === 'approaching';
  const isDone      = isVisited || isSkipped;

  /* ── Timeline dot color ── */
  const dotBg = isVisited ? '#1B4332'
    : isActive || isNear   ? '#C85A2A'
    : isSkipped            ? '#999'
    : categoryColor;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isSkipped ? 0.52 : 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={`location-card relative ml-8 mb-4 rounded-xl border shadow-sm transition-all ${
        isActive || isNear ? 'active' : ''
      }`}
      style={{
        backgroundColor: '#fdf9f7',
        borderColor: isActive || isNear ? '#C85A2A' : '#ddd9d0',
        borderLeftWidth: isActive || isNear ? '3px' : '1px',
        boxShadow: isActive ? '0 4px 12px rgba(200,90,42,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Timeline dot (positioned outside card left edge) ── */}
      <div
        className="absolute -left-[2.35rem] top-4 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm z-10"
        style={{ background: dotBg }}
      >
        {isVisited ? (
          <CheckCircle className="w-3 h-3 text-white" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: '9px' }}>{stop.visit_order}</span>
        )}
      </div>

      <div className="px-4 py-4">
        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            {/* Category + status badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span
                className="status-badge"
                style={{ background: `${categoryColor}1a`, color: categoryColor }}
              >
                {categoryEmoji(stop.category)} {stop.category}
              </span>
              {isActive && <span className="status-badge active">● Active</span>}
              {isNear   && <span className="status-badge active">⟳ Near</span>}
              {isVisited && <span className="status-badge visited">✓ Visited</span>}
              {isSkipped && <span className="status-badge skipped">✕ Skipped</span>}
            </div>

            {/* Name */}
            <h3
              className={`font-semibold text-sm leading-tight mb-1 ${isSkipped ? 'line-through' : ''}`}
              style={{ color: isSkipped ? '#a89f97' : '#2d2621' }}
            >
              {stop.name}
            </h3>

            {/* Description */}
            {stop.description && (
              <p className="text-xs mb-2 leading-relaxed line-clamp-2" style={{ color: '#6b6460' }}>
                {stop.description}
              </p>
            )}

            {/* Time + duration row */}
            <div className="flex items-center gap-3 text-xs font-mono-data flex-wrap" style={{ color: '#6b6460' }}>
              {stop.planned_start && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {stop.planned_start} – {stop.planned_end}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatDuration(stop.duration_min)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Action buttons (active only) ── */}
        {!isDone && (
          <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#ebe8e4' }}>
            {(stop.status === 'pending' || stop.status === 'approaching') && (
              <>
                <button
                  onClick={() => onCheckIn(stop.id)}
                  className="flex-1 h-8 text-xs rounded-lg flex items-center justify-center gap-1 font-medium transition-colors"
                  style={{ backgroundColor: '#1B4332', color: 'white' }}
                >
                  <Navigation className="w-3 h-3" /> Check In
                </button>
                <button
                  onClick={() => onMarkDone(stop.id)}
                  title="Mark as done directly"
                  className="h-8 px-3 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors"
                  style={{ backgroundColor: '#2d6a4f', color: 'white', border: '1px solid #1B4332' }}
                >
                  <CheckCircle className="w-3 h-3" /> Done
                </button>
              </>
            )}
            {stop.status === 'in-progress' && (
              <button
                onClick={() => onMarkDone(stop.id)}
                className="flex-1 h-8 text-xs rounded-lg flex items-center justify-center gap-1 font-semibold transition-all"
                style={{ backgroundColor: '#1B4332', color: 'white', boxShadow: '0 2px 8px rgba(27,67,50,0.3)' }}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark as Done
              </button>
            )}
            <button
              onClick={() => onSkip(stop.id)}
              className="h-8 px-3 rounded-lg text-xs flex items-center gap-1 transition-colors"
              style={{ backgroundColor: '#f5f3f0', border: '1px solid #ddd9d0', color: '#a89f97' }}
            >
              <SkipForward className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Travel to next stop ── */}
        {stop.travel_to_next_min > 0 && (
          <div className="mt-3 pt-2 border-t" style={{ borderColor: '#ebe8e4' }}>
            <div className="flex items-center gap-2 text-xs font-mono-data" style={{ color: '#a89f97' }}>
              <div className="flex-1 h-px" style={{ backgroundColor: '#ebe8e4' }} />
              <Navigation className="w-3 h-3" />
              <span>
                {stop.route_is_fallback ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" style={{ color: '#C85A2A' }} />
                    ~{formatDistance(stop.travel_to_next_m)} est. · ~{Math.round(stop.travel_to_next_min)}min
                  </span>
                ) : (
                  `${formatDistance(stop.travel_to_next_m)} road · ~${Math.round(stop.travel_to_next_min)}min`
                )}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#ebe8e4' }} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
);
