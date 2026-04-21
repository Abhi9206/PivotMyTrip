import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight,
  CornerDownLeft, CornerDownRight, Navigation, Flag,
} from 'lucide-react';
import type { RouteStep } from '../lib/types';

function MapResizer({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 320);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}
import L from 'leaflet';
import { getStatusColor, getCategoryColor, haversineDistance } from '../lib/simulationEngine';
import { categoryEmoji, formatDistance } from '../lib/utils';
import type { Stop, LatLng, RouteSegment } from '../lib/types';

// Fix leaflet default icon path resolution
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Icon factories ─────────────────────────────────────────────────────────

function createStopIcon(stop: Stop): L.DivIcon {
  const catColor = getCategoryColor(stop.category);
  const isActive = stop.status === 'in-progress' || stop.status === 'approaching';
  const isCompleted = stop.status === 'completed';
  const isSkipped = stop.status === 'skipped';
  const num = stop.visit_order;
  const emoji = categoryEmoji(stop.category);

  let html: string;
  let size: number;

  if (isCompleted) {
    size = 32;
    html = `<div style="
      background:#22c55e;width:${size}px;height:${size}px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);
      font-size:15px;color:white;font-weight:bold;">✓</div>`;
  } else if (isSkipped) {
    size = 28;
    html = `<div style="
      background:#6b7280;width:${size}px;height:${size}px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      font-size:12px;color:#d1d5db;">✕</div>`;
  } else if (isActive) {
    // Pulsing orange ring for active stop
    size = 54;
    const statusColor = stop.status === 'in-progress' ? '#f97316' : '#eab308';
    html = `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:0;border-radius:50%;
        background:${statusColor};opacity:0.2;
        animation:markerPulse 1.8s ease-in-out infinite;"></div>
      <div style="position:absolute;inset:9px;background:${statusColor};border-radius:50%;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
        <span style="font-size:13px;font-weight:900;color:white;line-height:1;">${num}</span>
        <span style="font-size:10px;line-height:1.2;">${emoji}</span>
      </div>
    </div>`;
  } else {
    // Pending: solid numbered circle matching reference style
    size = 36;
    html = `<div style="
      background:${catColor};
      width:${size}px;height:${size}px;border-radius:50%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      border:3px solid white;
      box-shadow:0 3px 12px rgba(0,0,0,0.4);
      cursor:pointer;">
      <span style="font-size:13px;font-weight:900;color:white;line-height:1;">${num}</span>
      <span style="font-size:9px;line-height:1.2;">${emoji}</span>
    </div>`;
  }

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createStartIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background:#7c3aed;width:36px;height:36px;border-radius:10px;
      display:flex;align-items:center;justify-content:center;
      border:3px solid white;box-shadow:0 2px 12px rgba(124,58,237,0.6);
      font-size:18px;" title="Start location">🏠</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="position:relative;width:26px;height:26px;">
      <div style="position:absolute;inset:-10px;border-radius:50%;
        border:3px solid #3b82f6;opacity:0.3;
        animation:markerPulse 2s ease-in-out infinite;"></div>
      <div style="background:#3b82f6;width:18px;height:18px;border-radius:50%;
        margin:4px;border:3px solid white;
        box-shadow:0 2px 10px rgba(59,130,246,0.8);position:relative;z-index:2;"></div>
    </div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createArrowIcon(angleDeg: number, color: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      transform:rotate(${angleDeg}deg);
      color:${color};
      font-size:13px;line-height:1;
      filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8));
      text-shadow:0 0 4px rgba(255,255,255,0.6);">▶</div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// ── Map helpers ────────────────────────────────────────────────────────────

function bearing(from: [number, number], to: [number, number]): number {
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function midpointOf(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function FitBounds({ stops, startPos }: { stops: Stop[]; startPos?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = stops.map(s => [s.lat, s.lon]);
    if (startPos) pts.push([startPos.lat, startPos.lon]);
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [map, stops, startPos]);
  return null;
}

function AutoCenterUser({ userPos }: { userPos: LatLng | null }) {
  const map = useMap();
  const prevPos = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!userPos) return;
    const prev = prevPos.current;
    if (!prev || Math.abs(prev.lat - userPos.lat) > 0.0004 || Math.abs(prev.lon - userPos.lon) > 0.0004) {
      map.panTo([userPos.lat, userPos.lon], { animate: true, duration: 0.3 });
    }
    prevPos.current = userPos;
  }, [userPos, map]);
  return null;
}

// ── Route segment rendering helpers ───────────────────────────────────────

interface SegmentStyle {
  color: string;
  outlineColor: string;
  weight: number;
  outlineWeight: number;
  dashArray?: string;
  opacity: number;
}

// Google Maps-style single-colour route palette
const ROUTE_BLUE   = '#1A73E8';   // active / pending segments
const ROUTE_DONE   = '#9ca3af';   // completed segments
const ROUTE_HOME   = '#7c3aed';   // home leg

function getSegmentStyle(
  fromStop: Stop | undefined,
  toStop: Stop | undefined,
  isFallback: boolean,
  fromId?: string,
  toId?: string,
): SegmentStyle {
  // Home leg — purple, solid when OSRM succeeded, dashed only for haversine fallback
  if (fromId === '__home_start__' || toId === '__home_end__') {
    return isFallback
      ? { color: ROUTE_HOME, outlineColor: 'white', weight: 3, outlineWeight: 5, dashArray: '8,5', opacity: 0.75 }
      : { color: ROUTE_HOME, outlineColor: 'white', weight: 5, outlineWeight: 8, opacity: 0.9 };
  }
  // Completed segment — grey dashed
  const isCompleted = fromStop?.status === 'completed' && toStop?.status === 'completed';
  if (isCompleted) {
    return { color: ROUTE_DONE, outlineColor: 'white', weight: 3, outlineWeight: 5, dashArray: '6,6', opacity: 0.5 };
  }
  // Fallback straight line — same blue but dashed so the user knows it's estimated
  if (isFallback) {
    return { color: ROUTE_BLUE, outlineColor: 'white', weight: 4, outlineWeight: 7, dashArray: '6,8', opacity: 0.65 };
  }
  // Default: road-following route — solid Google Maps blue
  return { color: ROUTE_BLUE, outlineColor: 'white', weight: 6, outlineWeight: 9, opacity: 1 };
}

// ── Turn-direction icon helper ─────────────────────────────────────────────
function TurnIcon({ type, modifier }: { type: string; modifier: string }) {
  const cls = 'w-7 h-7 text-white';
  if (type === 'arrive' || type === 'depart') return <Flag className={cls} />;
  switch (modifier) {
    case 'left':        return <ArrowLeft className={cls} />;
    case 'sharp left':  return <CornerDownLeft className={cls} />;
    case 'slight left': return <ArrowUpLeft className={cls} />;
    case 'right':       return <ArrowRight className={cls} />;
    case 'sharp right': return <CornerDownRight className={cls} />;
    case 'slight right':return <ArrowUpRight className={cls} />;
    case 'uturn':       return <Navigation className={`${cls} rotate-180`} />;
    default:            return <ArrowUp className={cls} />;
  }
}

function formatStepDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 10) * 10} m`;
}

// ── Main component ─────────────────────────────────────────────────────────

export interface NomadMapProps {
  stops: Stop[];
  userPosition: LatLng | null;
  routeSegments: RouteSegment[];
  startPosition?: LatLng | null;
  isFullscreen?: boolean;
  isRoutingLoading?: boolean;
}

export function NomadMap({ stops, userPosition, routeSegments, startPosition, isFullscreen = false, isRoutingLoading = false }: NomadMapProps) {
  const center: [number, number] =
    stops.length > 0 ? [stops[0].lat, stops[0].lon] : [48.8566, 2.3522];

  const activeStop = stops.find(s => s.status === 'in-progress' || s.status === 'approaching');
  const activeIdx  = activeStop ? stops.indexOf(activeStop) : -1;
  const nextStop   = activeIdx >= 0 && activeIdx < stops.length - 1 ? stops[activeIdx + 1] : null;

  // Find next turn step from the active segment's steps
  const activeSegment = activeStop
    ? routeSegments.find(s => s.from_id === activeStop.id || s.to_id === activeStop.id)
    : null;
  const nextStep: RouteStep | undefined = activeSegment?.steps?.find(
    s => s.maneuver_type !== 'depart' && s.distance_m > 0
  );

  const distToNext = userPosition && nextStop
    ? haversineDistance(userPosition, { lat: nextStop.lat, lon: nextStop.lon })
    : null;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden relative flex flex-col">

      {/* ── Google Maps-style navigation bar ── */}
      {activeStop && (
        <div className="flex-shrink-0 z-10 shadow-lg" style={{ backgroundColor: '#1A73E8' }}>
          {/* Row 1: turn icon + main instruction */}
          <div className="flex items-center gap-0">
            {/* Turn icon block */}
            <div className="flex items-center justify-center w-16 h-16 flex-shrink-0" style={{ backgroundColor: '#1557B0' }}>
              {nextStep
                ? <TurnIcon type={nextStep.maneuver_type} modifier={nextStep.maneuver_modifier} />
                : <Navigation className="w-7 h-7 text-white" />}
            </div>
            {/* Instruction + distance */}
            <div className="flex-1 px-3 py-2 min-w-0">
              {nextStep && nextStep.instruction ? (
                <>
                  <p className="text-white font-bold text-base leading-tight truncate">
                    {nextStep.maneuver_modifier && nextStep.maneuver_modifier !== 'straight'
                      ? `${nextStep.maneuver_modifier.charAt(0).toUpperCase() + nextStep.maneuver_modifier.slice(1)} onto`
                      : 'Continue on'}
                    {' '}{nextStep.instruction}
                  </p>
                  <p className="text-blue-200 text-sm font-semibold mt-0.5">
                    {formatStepDistance(nextStep.distance_m)}
                  </p>
                </>
              ) : (
                <p className="text-white font-bold text-base leading-tight truncate">
                  Head to {nextStop ? nextStop.name : activeStop.name}
                </p>
              )}
            </div>
            {/* ETA block */}
            {(distToNext !== null || nextStop) && (
              <div className="flex-shrink-0 text-right px-3 py-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                {distToNext !== null && (
                  <p className="text-white font-black text-sm">{formatDistance(distToNext)}</p>
                )}
                {nextStop && nextStop.travel_to_next_min > 0 && (
                  <p className="text-blue-200 text-xs">{Math.round(nextStop.travel_to_next_min)} min</p>
                )}
              </div>
            )}
          </div>
          {/* Row 2: destination label */}
          <div className="flex items-center gap-2 px-4 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-white" style={{ fontSize: '9px', fontWeight: 900 }}>
              {activeStop.visit_order}
            </span>
            <span className="text-white/80 text-xs truncate">
              {activeStop.status === 'in-progress' ? '● At ' : '⟳ Near '}{activeStop.name}
            </span>
            {nextStop && (
              <>
                <span className="text-white/40 text-xs">→</span>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-white" style={{ fontSize: '9px', fontWeight: 900 }}>
                  {nextStop.visit_order}
                </span>
                <span className="text-white/80 text-xs truncate">{nextStop.name}</span>
              </>
            )}
            {!nextStop && (
              <span className="text-white/60 text-xs ml-auto">🎯 Last stop today</span>
            )}
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          {/* Voyager tile layer (clean, readable) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />

          <MapResizer trigger={isFullscreen} />
          <FitBounds stops={stops} startPos={startPosition} />
          {userPosition && <AutoCenterUser userPos={userPosition} />}

          {/* Start location marker */}
          {startPosition && (
            <Marker position={[startPosition.lat, startPosition.lon]} icon={createStartIcon()}>
              <Popup>
                <div style={{ minWidth: '120px', fontSize: '12px' }}>
                  <strong>🏠 Start Location</strong>
                  <div style={{ color: '#6b7280', marginTop: 2 }}>Your base / hotel</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ── Route outlines (white stroke rendered FIRST so blue renders on top) ── */}
          {routeSegments.map((seg, i) => {
            const positions = seg.geometry.coordinates.map(
              ([lon, lat]) => [lat, lon] as [number, number]
            );
            if (positions.length < 2) return null;
            const fromStop = stops.find(s => s.id === seg.from_id);
            const toStop   = stops.find(s => s.id === seg.to_id);
            const style    = getSegmentStyle(fromStop, toStop, seg.is_fallback, seg.from_id, seg.to_id);
            const isCompleted = fromStop?.status === 'completed' && toStop?.status === 'completed';
            if (isCompleted) return null; // no outline on grey completed segs

            return (
              <Polyline
                key={`outline-${seg.from_id}-${seg.to_id}-${i}`}
                positions={positions}
                pathOptions={{
                  color: style.outlineColor,
                  weight: style.outlineWeight,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            );
          })}

          {/* ── Route coloured lines (rendered ON TOP of outlines) ── */}
          {routeSegments.map((seg, i) => {
            const positions = seg.geometry.coordinates.map(
              ([lon, lat]) => [lat, lon] as [number, number]
            );
            if (positions.length < 2) return null;
            const fromStop = stops.find(s => s.id === seg.from_id);
            const toStop   = stops.find(s => s.id === seg.to_id);
            const style    = getSegmentStyle(fromStop, toStop, seg.is_fallback, seg.from_id, seg.to_id);

            return (
              <Polyline
                key={`line-${seg.from_id}-${seg.to_id}-${i}`}
                positions={positions}
                pathOptions={{
                  color: style.color,
                  weight: style.weight,
                  dashArray: style.dashArray,
                  opacity: style.opacity,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            );
          })}

          {/* ── Direction arrows — one per segment midpoint ── */}
          {routeSegments.map((seg, i) => {
            const positions = seg.geometry.coordinates.map(
              ([lon, lat]) => [lat, lon] as [number, number]
            );
            if (positions.length < 2) return null;

            const fromStop = stops.find(s => s.id === seg.from_id);
            const toStop   = stops.find(s => s.id === seg.to_id);
            const isCompleted = fromStop?.status === 'completed' && toStop?.status === 'completed';
            if (isCompleted) return null;

            const midIdx    = Math.floor(positions.length / 2);
            const arrowFrom = positions[Math.max(0, midIdx - 1)];
            const arrowTo   = positions[Math.min(positions.length - 1, midIdx + 1)];
            const arrowBearing = bearing(arrowFrom, arrowTo);
            const arrowPos  = midpointOf(arrowFrom, arrowTo);

            const style = getSegmentStyle(fromStop, toStop, seg.is_fallback, seg.from_id, seg.to_id);

            return (
              <Marker
                key={`arrow-${seg.from_id}-${seg.to_id}-${i}`}
                position={arrowPos}
                icon={createArrowIcon(arrowBearing, style.color)}
                interactive={false}
                zIndexOffset={-100}
              />
            );
          })}

          {/* ── Fallback: dashed straight lines while route is loading ── */}
          {routeSegments.length === 0 &&
            stops
              .filter(s => s.status !== 'skipped')
              .map((stop, i, arr) => {
                if (i === arr.length - 1) return null;
                const next = arr[i + 1];
                return (
                  <Polyline
                    key={`fallback-${stop.id}`}
                    positions={[[stop.lat, stop.lon], [next.lat, next.lon]]}
                    pathOptions={{ color: '#93c5fd', weight: 2, dashArray: '5,10', opacity: 0.55 }}
                  />
                );
              })}

          {/* ── Stop markers ── */}
          {stops.map(stop => (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lon]}
              icon={createStopIcon(stop)}
              zIndexOffset={stop.status === 'in-progress' || stop.status === 'approaching' ? 500 : 0}
            >
              <Popup>
                <div style={{ minWidth: '170px', fontFamily: 'sans-serif' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 3 }}>
                    #{stop.visit_order} {stop.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {categoryEmoji(stop.category)} {stop.category} · {stop.duration_min}min
                  </div>
                  {stop.planned_start && (
                    <div style={{ fontSize: '11px', marginTop: 4, color: '#374151' }}>
                      🕐 {stop.planned_start} – {stop.planned_end}
                    </div>
                  )}
                  {stop.travel_to_next_m > 0 && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 3 }}>
                      → Next: {formatDistance(stop.travel_to_next_m)} · ~{Math.round(stop.travel_to_next_min)}min
                      {stop.route_is_fallback && <span style={{ color: '#f59e0b' }}> (est.)</span>}
                    </div>
                  )}
                  <div style={{
                    marginTop: 6, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    color: stop.status === 'completed'   ? '#22c55e'
                         : stop.status === 'in-progress' ? '#f97316'
                         : stop.status === 'approaching' ? '#eab308'
                         : stop.status === 'skipped'     ? '#6b7280'
                         : '#2563eb',
                  }}>
                    ● {stop.status}
                  </div>
                  {stop.description && (
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: 4, lineHeight: 1.4 }}>
                      {stop.description.slice(0, 110)}{stop.description.length > 110 ? '…' : ''}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── User / GPS position ── */}
          {userPosition && (
            <Marker
              position={[userPosition.lat, userPosition.lon]}
              icon={createUserIcon()}
              zIndexOffset={1000}
            />
          )}
        </MapContainer>

      </div>
    </div>
  );
}
