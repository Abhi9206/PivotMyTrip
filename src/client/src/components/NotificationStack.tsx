import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useNomad } from '../contexts/NomadContext';
import type { Notification } from '../lib/types';

const ICONS = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const NOTE_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'rgba(27,67,50,0.08)',  border: 'rgba(27,67,50,0.25)',  text: '#1B4332', icon: '#1B4332' },
  info:    { bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.25)', text: '#1d4ed8', icon: '#1d4ed8' },
  warning: { bg: 'rgba(200,90,42,0.08)', border: 'rgba(200,90,42,0.3)',  text: '#C85A2A', icon: '#C85A2A' },
  error:   { bg: 'rgba(201,69,69,0.08)', border: 'rgba(201,69,69,0.3)',  text: '#c94545', icon: '#c94545' },
};

function NotificationItem({ note, onDismiss }: { note: Notification; onDismiss: () => void }) {
  const Icon = ICONS[note.type];
  const s = NOTE_STYLES[note.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-card-md max-w-sm"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: s.icon }} />
      <span className="text-sm flex-1 leading-relaxed">{note.message}</span>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
        style={{ color: s.text }}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function NotificationStack() {
  const { notifications, dismissNotification } = useNomad();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map(note => (
          <div key={note.id} className="pointer-events-auto">
            <NotificationItem
              note={note}
              onDismiss={() => dismissNotification(note.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
