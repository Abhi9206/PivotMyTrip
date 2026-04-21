import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Loader2,
  CheckSquare,
  Square,
  RotateCcw,
  AlertCircle,
  StopCircle,
} from 'lucide-react';
import type { Stop, MidTripSuggestion, LatLng } from '../lib/types';
import { getMidTripSuggestions, applyMidTripSuggestions } from '../lib/apiService';
import { categoryEmoji } from '../lib/utils';
import { VoiceButton } from './VoiceButton';

type ActionMode = 'insert' | 'replace' | 'remove';
type InsertPlacement = 'before' | 'after';

interface MidTripPanelProps {
  isOpen: boolean;
  onClose: () => void;
  stops: Stop[];
  destination: string;
  dayNum: number;
  interests: string[];
  pace: string;
  startTime?: string;
  transportMode?: 'walking' | 'driving' | 'cycling';
  currentPosition?: LatLng | null;
  currentSimTime?: Date | null;
  onApply: (updatedStops: Stop[], totalDistM: number, totalDurMin: number) => void;
}

const LOADING_MESSAGES = [
  'Searching best places nearby...',
  'Curating suggestions for you...',
  'Finding hidden gems...',
  'Checking local recommendations...',
  'Matching your interests...',
  'Discovering top-rated spots...',
  'Tailoring options just for you...',
  'Scanning the neighbourhood...',
];

const ACTION_MODES: { value: ActionMode; label: string; desc: string }[] = [
  { value: 'insert', label: 'Insert', desc: 'Add near selected stop' },
  { value: 'replace', label: 'Replace', desc: 'Swap out selected stop' },
  { value: 'remove', label: 'Remove', desc: 'Delete selected stop' },
];

export function MidTripPanel({
  isOpen,
  onClose,
  stops,
  destination,
  dayNum,
  interests,
  pace,
  startTime,
  transportMode,
  currentPosition,
  currentSimTime,
  onApply,
}: MidTripPanelProps) {
  const [anchorStopId, setAnchorStopId] = useState('');
  const [userRequest, setUserRequest] = useState('');
  const [actionMode, setActionMode] = useState<ActionMode>('insert');
  const [insertPlacement, setInsertPlacement] = useState<InsertPlacement>('after');
  const [showInsertPlacement, setShowInsertPlacement] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<MidTripSuggestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [requestSummary, setRequestSummary] = useState('');
  const [intent, setIntent] = useState('');
  const [cached, setCached] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const available = stops.filter((s) => s.status !== 'completed' && s.status !== 'skipped');
    const currentIsValid = available.some((s) => s.id === anchorStopId);
    if (!anchorStopId || !currentIsValid) {
      const active = available.find((s) => s.status === 'in-progress' || s.status === 'approaching');
      setAnchorStopId((active || available[0] || stops[0])?.id ?? '');
    }
  }, [isOpen, stops, anchorStopId]);

  useEffect(() => {
    // Always clear suggestions/selections when switching modes — suggestions
    // from 'insert' are irrelevant in 'replace' context and vice versa.
    setSuggestions([]);
    setSelectedIndices([]);
    setRequestSummary('');
    setIntent('');
    setCached(false);
    setError('');

    if (actionMode !== 'insert') {
      setInsertPlacement('after');
      setShowInsertPlacement(false);
    }
  }, [actionMode]);

  // Cycle loading messages while fetching
  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIdx(0);
    const id = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  const availableStops = stops.filter((s) => s.status !== 'completed' && s.status !== 'skipped');
  const anchorStop = stops.find((s) => s.id === anchorStopId);
  const anchorIdx = anchorStop ? stops.indexOf(anchorStop) : -1;

  const remainingStops =
    anchorIdx >= 0
      ? stops
          .slice(anchorIdx + 1)
          .filter((s) => s.status !== 'completed' && s.status !== 'skipped')
      : [];

  const toggleSelection = (i: number) =>
    setSelectedIndices((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const handleGetSuggestions = async () => {
    if (!anchorStop) {
      setError('Please select an anchor stop.');
      return;
    }

    if (actionMode === 'remove') {
      setError('Remove mode does not need suggestions. Just click Remove Stop.');
      return;
    }

    if (!userRequest.trim()) {
      setError('Please describe what you want to explore.');
      return;
    }

    setError('');
    setIsLoading(true);
    setSuggestions([]);
    setSelectedIndices([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await getMidTripSuggestions({
        destination,
        day_num: dayNum,
        anchor_stop_id: anchorStop.id,
        anchor_stop_name: anchorStop.name,
        remaining_stops: remainingStops.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
        })),
        interests,
        pace,
        user_request: userRequest,
        signal: controller.signal,
      });

      setSuggestions(result.suggestions);
      setRequestSummary(result.request_summary);
      setIntent(result.intent);
      setCached(result.cached);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message || 'Failed to get suggestions');
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCancelSuggestions = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  };

  const handleApply = async () => {
    if (!anchorStop) {
      setError('Please select an anchor stop.');
      return;
    }

    if (actionMode !== 'remove' && selectedIndices.length === 0) {
      setError('Select at least one suggestion.');
      return;
    }

    if (actionMode === 'replace' && selectedIndices.length > 1) {
      setError('Replace mode: select only one suggestion.');
      return;
    }

    setError('');
    setIsApplying(true);

    try {
      const selected =
        actionMode === 'remove' ? [] : selectedIndices.map((i) => suggestions[i]);

      const result = await applyMidTripSuggestions({
        destination,
        day_num: dayNum,
        action_mode: actionMode,
        insert_placement: actionMode === 'insert' ? insertPlacement : undefined,
        anchor_stop_id: anchorStop.id,
        selected_suggestions: selected,
        all_stops: stops,
        start_time: startTime || '09:00',
        transport_mode: transportMode || 'walking',
        preserve_manual_order: true,
        current_time: currentSimTime ? currentSimTime.toISOString() : '',
        current_lat: currentPosition?.lat ?? 0.0,
        current_lon: currentPosition?.lon ?? 0.0,
      });

      onApply(result.stops as Stop[], result.total_distance_m, result.total_duration_min);

      // Reset all state so the next open starts clean
      setSuggestions([]);
      setSelectedIndices([]);
      setUserRequest('');
      setRequestSummary('');
      setIntent('');
      setCached(false);
      setError('');
      setAnchorStopId('');
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Failed to apply changes');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setAnchorStopId('');
    setSuggestions([]);
    setSelectedIndices([]);
    setUserRequest('');
    setRequestSummary('');
    setIntent('');
    setCached(false);
    setError('');
    onClose();
  };

  const handleClear = () => {
    setSuggestions([]);
    setSelectedIndices([]);
    setRequestSummary('');
    setIntent('');
    setCached(false);
    setError('');
    if (actionMode !== 'remove') {
      setUserRequest('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[2500]"
            onClick={handleClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-[420px] max-w-full z-[2600] flex flex-col shadow-2xl"
            style={{
              backgroundColor: '#f5f3f0',
              borderLeft: '1px solid #ddd9d0',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid #ddd9d0' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#1B4332' }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#2d2621' }}>
                    Edit Your Itinerary
                  </h2>
                  <p className="text-xs" style={{ color: '#6b6460' }}>
                    Edit stops, timing, or add new places to improve your plan
                  </p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#6b6460' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ebe8e4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: '#fdf9f7', border: '1px solid #ddd9d0' }}
              >
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: '#5a524d' }}
                >
                  Current / Anchor Stop
                </label>

                <select
                  value={anchorStopId}
                  onChange={(e) => {
                    setAnchorStopId(e.target.value);
                    setSuggestions([]);
                    setSelectedIndices([]);
                    setRequestSummary('');
                    setIntent('');
                    setCached(false);
                    setError('');
                  }}
                  className="w-full px-3 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
  backgroundColor: '#fdf9f7',
  color: '#1f1a17',   // darker than before
  border: '1px solid #ddd9d0',
  fontWeight: 600     // 🔥 THIS makes the difference
}}
                >
                  {availableStops.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.visit_order} {s.name}
                    </option>
                  ))}
                </select>

                {anchorStop && remainingStops.length > 0 && (
                  <p className="text-xs mt-2" style={{ color: '#6b6460' }}>
                    {remainingStops.length} remaining stop
                    {remainingStops.length !== 1 ? 's' : ''} after this
                  </p>
                )}
              </div>

              {actionMode !== 'remove' && (
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: '#fdf9f7', border: '1px solid #ddd9d0' }}
                >
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: '#5a524d' }}
                  >
                    What do you want to explore?
                  </label>

                  <div className="relative">
                    <textarea
                      value={userRequest}
                      onChange={(e) => setUserRequest(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && handleGetSuggestions()}
                      placeholder={
                        'e.g.\nFind a good coffee spot nearby\nAdd a scenic place to visit\nSuggest something fun around here'
                      }
                      rows={4}
                      className="w-full px-4 py-3 pr-14 rounded-xl text-base font-medium resize-none outline-none transition-all"
  style={{
    backgroundColor: '#fdf9f7',
    color: '#1f1a17',        // 🔥 darker text
    border: '1px solid #d6d0c8',
    opacity: 1               // 🔥 IMPORTANT (removes faded look)
  }}
                    />
                    <div className="absolute right-2 bottom-2">
                      <VoiceButton
                        compact
                        onTranscript={(t) =>
                          setUserRequest((prev) => (prev ? `${prev} ${t}` : t))
                        }
                      />
                    </div>
                  </div>

                  <p className="text-xs mt-2" style={{ color: '#8b817b' }}>
                    Press Ctrl+Enter to get suggestions
                  </p>
                </div>
              )}

              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: '#fdf9f7', border: '1px solid #ddd9d0' }}
              >
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: '#5a524d' }}
                >
                  Apply Mode
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {ACTION_MODES.map((m) => {
                    const active = actionMode === m.value;

                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setActionMode(m.value);
                          if (m.value === 'insert') {
                            setShowInsertPlacement(true);
                          } else {
                            setShowInsertPlacement(false);
                          }
                        }}
                        className="px-4 py-3 rounded-xl text-center transition-all shadow-sm"
                        style={{
                          backgroundColor: active ? '#1B4332' : '#ffffff',
                          border: active ? '1px solid #1B4332' : '1px solid #cfc7bd',
                          color: active ? '#ffffff' : '#2d2621',
                          boxShadow: active
                            ? '0 6px 14px rgba(27,67,50,0.22)'
                            : '0 2px 6px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div
                          className="text-sm font-semibold"
                          style={{ color: active ? '#ffffff' : '#2d2621' }}
                        >
                          {m.label}
                        </div>
                        <div
                          className="text-xs mt-1 leading-tight"
                          style={{ color: active ? 'rgba(255,255,255,0.85)' : '#6b6460' }}
                        >
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {actionMode === 'insert' && showInsertPlacement && (
                  <div className="mt-3">
                    <label
                      className="block text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: '#6b6460' }}
                    >
                      Insert Placement
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInsertPlacement('before')}
                        className="px-4 py-3 rounded-xl text-center transition-all shadow-sm"
                        style={{
                          backgroundColor:
                            insertPlacement === 'before' ? '#1B4332' : '#ffffff',
                          border:
                            insertPlacement === 'before'
                              ? '1px solid #1B4332'
                              : '1px solid #cfc7bd',
                          color: insertPlacement === 'before' ? '#ffffff' : '#2d2621',
                          boxShadow:
                            insertPlacement === 'before'
                              ? '0 6px 14px rgba(27,67,50,0.22)'
                              : '0 2px 6px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div
                          className="text-sm font-semibold"
                          style={{
                            color: insertPlacement === 'before' ? '#ffffff' : '#2d2621',
                          }}
                        >
                          Before
                        </div>
                        <div
                          className="text-xs mt-1 leading-tight"
                          style={{
                            color:
                              insertPlacement === 'before'
                                ? 'rgba(255,255,255,0.85)'
                                : '#6b6460',
                          }}
                        >
                          Insert before selected stop
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInsertPlacement('after')}
                        className="px-4 py-3 rounded-xl text-center transition-all shadow-sm"
                        style={{
                          backgroundColor:
                            insertPlacement === 'after' ? '#1B4332' : '#ffffff',
                          border:
                            insertPlacement === 'after'
                              ? '1px solid #1B4332'
                              : '1px solid #cfc7bd',
                          color: insertPlacement === 'after' ? '#ffffff' : '#2d2621',
                          boxShadow:
                            insertPlacement === 'after'
                              ? '0 6px 14px rgba(27,67,50,0.22)'
                              : '0 2px 6px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div
                          className="text-sm font-semibold"
                          style={{
                            color: insertPlacement === 'after' ? '#ffffff' : '#2d2621',
                          }}
                        >
                          After
                        </div>
                        <div
                          className="text-xs mt-1 leading-tight"
                          style={{
                            color:
                              insertPlacement === 'after'
                                ? 'rgba(255,255,255,0.85)'
                                : '#6b6460',
                          }}
                        >
                          Insert after selected stop
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {actionMode === 'remove' && anchorStop && (
                <div
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: '#fff7ed',
                    border: '1px solid #f3d2a4',
                    color: '#7c4a03',
                  }}
                >
                  <p className="text-sm font-semibold mb-1">Remove selected stop</p>
                  <p className="text-xs leading-relaxed">
                    You are about to remove{' '}
                    <span className="font-semibold">{anchorStop.name}</span> from this day’s
                    itinerary. The remaining stops will be kept in the trip.
                  </p>
                </div>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 px-3 py-3 rounded-xl text-sm"
                    style={{
                      backgroundColor: '#fff1f1',
                      border: '1px solid #efcaca',
                      color: '#b42318',
                    }}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {actionMode !== 'remove' && (
                <AnimatePresence>
                  {requestSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-4 py-3 rounded-xl text-sm"
                      style={{
                        backgroundColor: '#edf6f1',
                        border: '1px solid #cfe4d7',
                        color: '#2d2621',
                      }}
                    >
                      <span className="font-semibold">AI understood: </span>
                      {requestSummary}
                      {cached && (
                        <span className="ml-2 text-xs" style={{ color: '#6b6460' }}>
                          (cached)
                        </span>
                      )}
                      {intent && intent !== 'general' && (
                        <span
                          className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                          style={{
                            backgroundColor: '#dce9e0',
                            color: '#1B4332',
                          }}
                        >
                          {intent}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {actionMode !== 'remove' && suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#6b6460' }}
                    >
                      {suggestions.length} Suggestion{suggestions.length !== 1 ? 's' : ''}
                    </p>

                    <button
                      type="button"
                      onClick={() => setSelectedIndices(suggestions.map((_, i) => i))}
                      className="text-xs font-medium"
                      style={{ color: '#1B4332' }}
                    >
                      Select all
                    </button>
                  </div>

                  {suggestions.map((sug, i) => {
                    const isSelected = selectedIndices.includes(i);

                    return (
                      <motion.div
                        key={`${sug.name}-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => toggleSelection(i)}
                        className="flex gap-3 p-4 rounded-2xl cursor-pointer transition-all select-none"
                        style={{
                          backgroundColor: isSelected ? '#edf6f1' : '#fdf9f7',
                          border: isSelected ? '1px solid #1B4332' : '1px solid #ddd9d0',
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" style={{ color: '#1B4332' }} />
                          ) : (
                            <Square className="w-4 h-4" style={{ color: '#8b817b' }} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm" style={{ color: '#2d2621' }}>
                              {sug.name}
                            </span>

                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: '#ede9e0',
                                color: '#6b6460',
                              }}
                            >
                              {categoryEmoji(sug.category)} {sug.category}
                            </span>

                            <span className="text-xs" style={{ color: '#8b817b' }}>
                              ⏱ {sug.estimated_duration_min} min
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed" style={{ color: '#6b6460' }}>
                            {sug.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {actionMode !== 'remove' &&
                suggestions.length === 0 &&
                !isLoading &&
                requestSummary && (
                  <div className="text-center py-8">
                    <Sparkles
                      className="w-10 h-10 mx-auto mb-2"
                      style={{ color: '#b7b0aa', opacity: 0.5 }}
                    />
                    <p className="text-sm" style={{ color: '#2d2621' }}>
                      No matching suggestions found.
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#6b6460' }}>
                      Try a broader or different request.
                    </p>
                  </div>
                )}
            </div>

            <div
              className="flex-shrink-0 p-4 space-y-2"
              style={{ borderTop: '1px solid #ddd9d0', backgroundColor: '#f5f3f0' }}
            >
              {actionMode !== 'remove' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGetSuggestions}
                    disabled={isLoading || isApplying}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: '#1B4332',
                      color: 'white',
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={loadingMsgIdx}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.3 }}
                            className="truncate"
                          >
                            {LOADING_MESSAGES[loadingMsgIdx]}
                          </motion.span>
                        </AnimatePresence>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Get AI Suggestions
                      </>
                    )}
                  </button>

                  {isLoading && (
                    <button
                      type="button"
                      onClick={handleCancelSuggestions}
                      title="Cancel"
                      className="px-3 py-3 rounded-xl flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: '#fff1f1',
                        border: '1px solid #efcaca',
                        color: '#b42318',
                      }}
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {(suggestions.length > 0 || actionMode === 'remove') && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={
                      isApplying ||
                      (!anchorStop && actionMode === 'remove') ||
                      (actionMode !== 'remove' && selectedIndices.length === 0)
                    }
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: actionMode === 'remove' ? '#fff1f1' : '#e8f0eb',
                      border:
                        actionMode === 'remove'
                          ? '1px solid #efcaca'
                          : '1px solid #cfe4d7',
                      color: actionMode === 'remove' ? '#b42318' : '#1B4332',
                    }}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {actionMode === 'remove' ? 'Removing...' : 'Applying...'}
                      </>
                    ) : (
                      <>
                        {actionMode === 'remove'
                          ? 'Remove Stop'
                          : `✓ Apply${selectedIndices.length > 0 ? ` (${selectedIndices.length})` : ''}`}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-colors"
                    style={{
                      backgroundColor: '#fdf9f7',
                      border: '1px solid #ddd9d0',
                      color: '#6b6460',
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}