import { useCallback, useRef, useState } from 'react';
import { transcribeAudio, parseVoiceCommand } from '../lib/apiService';
import type { VoiceCommandResult } from '../lib/types';

type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

interface UseVoiceReturn {
  state: VoiceState;
  error: string | null;
  transcript: string;
  isSupported: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ transcript: string; command: VoiceCommandResult } | null>;
  cancelRecording: () => void;
}

interface UseVoiceOptions {
  onResult?: (transcript: string, command: VoiceCommandResult) => void;
  itinerarySummary?: string;
  /** Skip the command-parse step — just transcribe and call onResult with a stub command */
  skipCommandParse?: boolean;
}

const FALLBACK_COMMAND: VoiceCommandResult = {
  intent: 'unknown',
  confidence: 0,
  params: {},
  human_response: 'Voice command received.',
};

export function useVoice(options?: string | UseVoiceOptions): UseVoiceReturn {
  const opts = typeof options === 'string' ? { itinerarySummary: options } : (options ?? {});
  const { itinerarySummary, onResult, skipCommandParse } = opts;

  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const startRecording = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setState('recording');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(msg);
      setState('error');
    }
  }, [isSupported]);

  const stopRecording = useCallback(async (): Promise<{
    transcript: string;
    command: VoiceCommandResult;
  } | null> => {
    if (!isSupported) return null;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;

    setState('processing');

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        // Stop all mic tracks
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const ext = recorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
          const nextTranscript = await transcribeAudio(blob, `recording.${ext}`);
          setTranscript(nextTranscript);

          const command = skipCommandParse
            ? { ...FALLBACK_COMMAND, human_response: nextTranscript }
            : await parseVoiceCommand(nextTranscript, itinerarySummary);

          setState('idle');
          onResult?.(nextTranscript, command);
          resolve({ transcript: nextTranscript, command });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Voice processing failed';
          setError(msg);
          setState('error');
          resolve(null);
        }
      };
      recorder.stop();
    });
  }, [isSupported, itinerarySummary, onResult, skipCommandParse]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setError(null);
    setTranscript('');
  }, []);

  return {
    state,
    error,
    transcript,
    isSupported,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
