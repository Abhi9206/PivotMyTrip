import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import type { VoiceCommandResult } from '../lib/types';

interface VoiceButtonProps {
  /** Full result: transcript + parsed command. Used in PlanningForm. */
  onResult?: (transcript: string, command: VoiceCommandResult) => void;
  /** Compact mode: transcript-only callback, used inside panels/textareas. */
  onTranscript?: (transcript: string) => void;
  itinerarySummary?: string;
  /** compact=true → icon-only button, no status text, no transcript bubble */
  compact?: boolean;
  className?: string;
}

export function VoiceButton({
  onResult,
  onTranscript,
  itinerarySummary,
  compact = false,
  className = '',
}: VoiceButtonProps) {
  // When compact mode uses onTranscript, skip the command-parse step
  const wrappedOnResult = onResult ?? (
    onTranscript
      ? (transcript: string, _cmd: VoiceCommandResult) => onTranscript(transcript)
      : undefined
  );

  const { isRecording, isProcessing, transcript, error, isSupported, startRecording, stopRecording } =
    useVoice({
      onResult: wrappedOnResult,
      itinerarySummary,
      skipCommandParse: compact && !onResult,
    });

  const transcriptTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleTranscript, setVisibleTranscript] = useState('');

  useEffect(() => {
    if (transcript) {
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
      setVisibleTranscript(transcript);
      transcriptTimeout.current = setTimeout(() => setVisibleTranscript(''), 4000);
    } else {
      setVisibleTranscript('');
    }
    return () => {
      if (transcriptTimeout.current) clearTimeout(transcriptTimeout.current);
    };
  }, [transcript]);

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`${compact ? 'p-2' : 'p-3'} rounded-lg border opacity-50 cursor-not-allowed`}
          style={{ backgroundColor: '#f5f3f0', borderColor: '#ddd9d0' }}
          title="Voice input is not supported in this browser. Try Chrome or Edge."
          aria-label="Voice input unavailable"
        >
          <MicOff className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: '#a89f97' }} />
        </div>
        {!compact && (
          <span className="text-xs" style={{ color: '#a89f97' }}>
            Voice unavailable — try Chrome or Edge
          </span>
        )}
      </div>
    );
  }

  // ── Compact mode: icon-only button ─────────────────────────────────────────
  if (compact) {
    return (
      <motion.button
        whileHover={!isProcessing ? { scale: 1.08 } : {}}
        whileTap={!isProcessing ? { scale: 0.92 } : {}}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        title={isRecording ? 'Stop recording' : isProcessing ? 'Processing…' : 'Voice input'}
        className={`relative p-2.5 rounded-xl border transition-all flex-shrink-0 ${
          isRecording
            ? 'bg-red-500/20 border-red-500 text-red-400'
            : isProcessing
            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-nomad-500/60 hover:text-nomad-300'
        } ${className}`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isRecording ? (
          <>
            <Mic className="w-4 h-4" />
            <span className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-40" />
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </motion.button>
    );
  }

  // ── Full mode ───────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={!isProcessing ? { scale: 1.05 } : {}}
          whileTap={!isProcessing ? { scale: 0.95 } : {}}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`relative p-3 rounded-xl border transition-all ${
            isRecording
              ? 'bg-red-500/20 border-red-500 text-red-400'
              : isProcessing
              ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-nomad-500/50 hover:text-nomad-300'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <>
              <Mic className="w-5 h-5" />
              <span className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-40" />
            </>
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </motion.button>

        <div className="text-sm">
          {isRecording && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 font-medium">
              Recording… (click to stop)
            </motion.span>
          )}
          {isProcessing && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-400">
              Processing…
            </motion.span>
          )}
          {!isRecording && !isProcessing && (
            <span className="text-gray-500 text-xs">Click to speak</span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {visibleTranscript && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/50"
          >
            <p className="text-xs text-gray-400 mb-0.5">Heard:</p>
            <p className="text-sm text-white italic">"{visibleTranscript}"</p>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
