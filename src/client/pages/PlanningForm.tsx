import { useState, useEffect, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Sparkles,
  Map,
  Home,
  Zap,
  Mic,
  Compass,
  Clock3,
  Route,
} from 'lucide-react';
import { useNomad } from '../contexts/NomadContext';
import { VoiceButton } from '../components/VoiceButton';
import type { TripFormData, TravelPace, TransportMode, VoiceCommandResult } from '../lib/types';

const HERO_BG =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';

const INTEREST_OPTIONS = [
  { id: 'history', label: 'History & Culture', emoji: '🏛️' },
  { id: 'food', label: 'Food & Dining', emoji: '🍽️' },
  { id: 'nature', label: 'Nature & Parks', emoji: '🌿' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'art', label: 'Art & Museums', emoji: '🎨' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌙' },
  { id: 'adventure', label: 'Adventure', emoji: '⛰️' },
  { id: 'architecture', label: 'Architecture', emoji: '🏙️' },
];

const POPULAR_DESTINATIONS = [
  'Paris, France',
  'Tokyo, Japan',
  'New York, USA',
  'Barcelona, Spain',
  'Rome, Italy',
  'Bangkok, Thailand',
  'Amsterdam, Netherlands',
  'Dubai, UAE',
  'London, UK',
  'Kyoto, Japan',
  'Prague, Czech Republic',
  'Lisbon, Portugal',
];

const paceOptions: { id: TravelPace; label: string; emoji: string; hint: string }[] = [
  { id: 'relaxed', label: 'Relaxed', emoji: '🧘', hint: 'More time per stop' },
  { id: 'balanced', label: 'Balanced', emoji: '🚶', hint: 'Standard timing' },
  { id: 'fast', label: 'Fast-paced', emoji: '🏃', hint: 'See more, move quick' },
];

const transportOptions: { id: TransportMode; label: string; emoji: string; hint: string }[] = [
  { id: 'walking', label: 'Walking', emoji: '🚶', hint: 'City walks & paths' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴', hint: 'Bike-friendly routes' },
  { id: 'driving', label: 'Driving', emoji: '🚗', hint: 'Road trips & far spots' },
];

export default function PlanningForm() {
  const [, navigate] = useLocation();
  const { generateTrip, isGenerating, generationProgress, addNotification } = useNomad();

  const [formData, setFormData] = useState<TripFormData>({
    destination: '',
    days: 3,
    interests: [],
    manual_places: [],
    pace: 'balanced',
    start_time: '09:00',
    start_location: '',
    transport_mode: 'walking',
  });

  const [newPlace, setNewPlace] = useState('');
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [showVoiceBubble, setShowVoiceBubble] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const LOADING_MESSAGES = [
    'Curating your itinerary…',
    'Searching best places…',
    'Finding hidden gems…',
    'Optimizing your route…',
    'Checking local hotspots…',
    'Personalizing your trip…',
    'Almost there…',
  ];

  useEffect(() => {
    if (!isGenerating) { setLoadingMsgIndex(0); return; }
    const id = setInterval(() => setLoadingMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, [isGenerating]);

  const filteredCities = POPULAR_DESTINATIONS.filter(
    c =>
      formData.destination.length > 0 &&
      c.toLowerCase().includes(formData.destination.toLowerCase())
  );

  const toggleInterest = (id: string) =>
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id],
    }));

  const addManualPlace = () => {
    const trimmed = newPlace.trim();
    if (trimmed && !formData.manual_places.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        manual_places: [...prev.manual_places, trimmed],
      }));
      setNewPlace('');
    }
  };

  const removeManualPlace = (place: string) =>
    setFormData(prev => ({
      ...prev,
      manual_places: prev.manual_places.filter(p => p !== place),
    }));

  const handleVoiceResult = (transcript: string, command: VoiceCommandResult) => {
    addNotification('info', command.human_response);

    if (transcript?.trim()) {
      setVoiceTranscript(transcript);
      setShowVoiceBubble(true);
      setTimeout(() => setShowVoiceBubble(false), 5000);
    }

    if (command.params.destination) {
      setFormData(prev => ({ ...prev, destination: command.params.destination! }));
    }

    if (command.params.days) {
      setFormData(prev => ({
        ...prev,
        days: Math.max(1, Math.min(14, command.params.days!)),
      }));
    }

    if (command.params.pace) {
      setFormData(prev => ({ ...prev, pace: command.params.pace! }));
    }

    if (command.params.interests?.length) {
      setFormData(prev => ({ ...prev, interests: command.params.interests! }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.destination.trim()) {
      setError('Please enter a destination.');
      return;
    }

    setError('');

    try {
      await generateTrip(formData);
      navigate('/review');
    } catch (err) {
      setError((err as Error).message || 'Failed to generate itinerary.');
    }
  };

  const inputClass = `w-full px-3 h-11 rounded-xl text-sm outline-none transition-all border focus:ring-2 focus:ring-offset-0`;
  const inputStyle = {
  borderColor: '#ddd9d0',
  backgroundColor: '#fffdfb',
  color: '#2d2621',
  ['--tw-ring-color' as string]: 'rgba(27,67,50,0.20)',
} as CSSProperties;

  const selectedPace = paceOptions.find(p => p.id === formData.pace)?.label || 'Balanced';
  const selectedTransport =
    transportOptions.find(t => t.id === formData.transport_mode)?.label || 'Walking';

  return (
  <div
    className="min-h-screen relative overflow-hidden"
    style={{ backgroundColor: '#f5f3f0' }}
  >
    {/* world map background */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url(${HERO_BG})`,
backgroundRepeat: 'no-repeat',
backgroundSize: 'cover',
backgroundPosition: 'center center',
opacity: 1.55,
      }}
    />

    {/* soft white/beige overlay so form stays readable */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'linear-gradient(rgba(245,243,240,0.38), rgba(245,243,240,0.42))',
      }}
    />

    {/* subtle branded glow */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(200,90,42,0.06), transparent 24%), radial-gradient(circle at top right, rgba(27,67,50,0.06), transparent 28%)',
      }}
    />

    <div className="relative z-10">
      <div className="max-w-[1700px] mx-auto px-4 md:px-6 py-4 md:py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 w-full">
          <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{color: '#6b6460'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ebe8e4')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ArrowLeft className="w-4 h-4"/>
            Back
          </button>

          <div className="flex items-center gap-2 ml-1">
            <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
                style={{backgroundColor: '#1B4332'}}
            >
              <MapPin className="w-4 h-4 text-white"/>
            </div>
            <span
                className="font-display text-xl font-semibold"
                style={{color: '#2d2621'}}
            >
              PivotMyTrip
            </span>
            <span
                className="hidden md:block text-sm italic"
                style={{color: '#1B4332'}}
            >
                ✨ Plans change. Your trip can too.
              </span>
          </div>

          <button
              onClick={() => navigate('/')}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all shadow-sm"
              style={{backgroundColor: '#1B4332', color: 'white'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#24543f')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1B4332')}
          >
            <Home className="w-4 h-4"/>
            Home
          </button>
        </div>

        <motion.div
            initial={{opacity: 0, y: 16}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.45}}
        >
          {/* Top Hero Card */}
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
                    <Compass className="w-3.5 h-3.5"/>
                    Smart trip planning
                  </span>
                </div>

                <h1
                    className="font-display text-3xl md:text-4xl font-bold mb-1"
                    style={{color: '#2d2621'}}
                >
                  Plan Your Trip
                </h1>
                <p className="text-sm md:text-base" style={{color: '#6b6460'}}>
                  Build a beautiful itinerary with real-time preferences, custom places,
                  and voice-powered trip input.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 min-w-[260px]">
                <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                >
                  <Route className="w-4 h-4 mx-auto mb-1" style={{color: '#C85A2A'}}/>
                  <p className="text-xs font-semibold" style={{color: '#2d2621'}}>
                    Replanning
                  </p>
                </div>
                <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                >
                  <Map className="w-4 h-4 mx-auto mb-1" style={{color: '#1B4332'}}/>
                  <p className="text-xs font-semibold" style={{color: '#2d2621'}}>
                    Live Routing
                  </p>
                </div>
                <div
                    className="rounded-2xl px-3 py-3 border text-center"
                    style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                >
                  <Mic className="w-4 h-4 mx-auto mb-1" style={{color: '#C85A2A'}}/>
                  <p className="text-xs font-semibold" style={{color: '#2d2621'}}>
                    Voice Input
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left form side */}
            <div className="xl:col-span-8">
              <div
                  className="rounded-3xl border shadow-sm p-5 md:p-6"
                  style={{
                    backgroundColor: 'rgba(255,253,251,0.92)',
                    borderColor: '#e3ddd5',
                    backdropFilter: 'blur(6px)',
                  }}
              >
                <div className="space-y-4">
                  {/* Destination */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium" style={{color: '#2d2621'}}>
                      Destination
                    </label>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <MapPin
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{color: '#6b6460'}}
                        />
                        <input
                            type="text"
                            value={formData.destination}
                            onChange={e => {
                              setFormData(prev => ({...prev, destination: e.target.value}));
                              setShowSuggestions(true);
                              setError('');
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            placeholder="e.g. Paris, France"
                            className={inputClass + ' pl-9'}
                            style={inputStyle}
                        />

                        <AnimatePresence>
                          {showSuggestions && filteredCities.length > 0 && (
                              <motion.div
                                  initial={{opacity: 0, y: -4}}
                                  animate={{opacity: 1, y: 0}}
                                  exit={{opacity: 0, y: -4}}
                                  className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-lg"
                                  style={{
                                    backgroundColor: '#fffdfb',
                                    border: '1px solid #ddd9d0',
                                  }}
                              >
                                {filteredCities.map(dest => (
                                    <button
                                        key={dest}
                                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
                                        style={{color: '#2d2621'}}
                                        onMouseEnter={e =>
                                            (e.currentTarget.style.backgroundColor = '#ede9e0')
                                        }
                                        onMouseLeave={e =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                        }
                                        onMouseDown={() => {
                                          setFormData(prev => ({...prev, destination: dest}));
                                          setShowSuggestions(false);
                                        }}
                                    >
                                      <MapPin
                                          className="w-3.5 h-3.5"
                                          style={{color: '#6b6460'}}
                                      />
                                      {dest}
                                    </button>
                                ))}
                              </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <VoiceButton
                          compact
                          onResult={handleVoiceResult}
                          itinerarySummary={
                            formData.destination
                                ? `Planning trip to ${formData.destination}`
                                : ''
                          }
                      />
                    </div>

                    <AnimatePresence>
                      {showVoiceBubble && voiceTranscript && (
                          <motion.div
                              initial={{opacity: 0, y: -6}}
                              animate={{opacity: 1, y: 0}}
                              exit={{opacity: 0, y: -6}}
                              className="rounded-2xl px-4 py-3 border flex items-start gap-3"
                              style={{
                                backgroundColor: 'rgba(27,67,50,0.08)',
                                borderColor: 'rgba(27,67,50,0.16)',
                              }}
                          >
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{backgroundColor: '#1B4332'}}
                            >
                              <Mic className="w-4 h-4 text-white"/>
                            </div>
                            <div>
                              <p
                                  className="text-xs font-semibold mb-1"
                                  style={{color: '#1B4332'}}
                              >
                                Voice input detected
                              </p>
                              <p className="text-sm" style={{color: '#2d2621'}}>
                                “{voiceTranscript}”
                              </p>
                            </div>
                          </motion.div>
                      )}
                    </AnimatePresence>

                    {!formData.destination && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {POPULAR_DESTINATIONS.slice(0, 4).map(dest => (
                              <button
                                  key={dest}
                                  onClick={() =>
                                      setFormData(prev => ({...prev, destination: dest}))
                                  }
                                  className="text-xs px-3 py-1.5 rounded-full transition-colors"
                                  style={{
                                    backgroundColor: '#ede9e0',
                                    color: '#6b6460',
                                    border: '1px solid #ddd9d0',
                                  }}
                              >
                                {dest}
                              </button>
                          ))}
                        </div>
                    )}
                  </div>

                  {/* Start location */}
                  <div className="space-y-1">
                    <label
                        className="text-sm font-medium flex items-center gap-1.5"
                        style={{color: '#2d2621'}}
                    >
                      <Home className="w-3.5 h-3.5" style={{color: '#1B4332'}}/>
                      Start Location
                      <span className="font-normal" style={{color: '#6b6460'}}>
                        (optional — hotel, station, or base)
                      </span>
                    </label>

                    <input
                        type="text"
                        value={formData.start_location}
                        onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              start_location: e.target.value,
                            }))
                        }
                        placeholder="e.g. Hotel de Ville, Paris or Gare du Nord"
                        className={inputClass}
                        style={inputStyle}
                    />

                    <p className="text-xs" style={{color: '#6b6460'}}>
                      Used as the day’s starting point for routing. Shown as 🏠 on the map.
                    </p>
                  </div>

                  {/* Two-column lower form */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {/* Left */}
                    <div className="space-y-4">
                      {/* Days */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium block mb-2"
                            style={{color: '#2d2621'}}
                        >
                          Number of Days
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                              onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    days: Math.max(1, prev.days - 1),
                                  }))
                              }
                              className="w-10 h-10 rounded-xl border flex items-center justify-center font-medium transition-colors"
                              style={{borderColor: '#ddd9d0', color: '#2d2621'}}
                              onMouseEnter={e =>
                                  (e.currentTarget.style.backgroundColor = '#ede9e0')
                              }
                              onMouseLeave={e =>
                                  (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                          >
                            −
                          </button>

                          <div
                              className="flex-1 h-10 border rounded-xl flex items-center justify-center font-mono-data font-semibold text-sm"
                              style={{
                                borderColor: '#ddd9d0',
                                color: '#2d2621',
                                backgroundColor: '#fdf9f7',
                              }}
                          >
                            {formData.days} {formData.days === 1 ? 'day' : 'days'}
                          </div>

                          <button
                              onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    days: Math.min(14, prev.days + 1),
                                  }))
                              }
                              className="w-10 h-10 rounded-xl border flex items-center justify-center font-medium transition-colors"
                              style={{borderColor: '#ddd9d0', color: '#2d2621'}}
                              onMouseEnter={e =>
                                  (e.currentTarget.style.backgroundColor = '#ede9e0')
                              }
                              onMouseLeave={e =>
                                  (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Travel pace */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium flex items-center gap-1.5 mb-2"
                            style={{color: '#2d2621'}}
                        >
                          <Zap className="w-3.5 h-3.5" style={{color: '#1B4332'}}/>
                          Travel Pace
                        </label>

                        <div className="grid grid-cols-3 gap-2">
                          {paceOptions.map(p => (
                              <button
                                  key={p.id}
                                  onClick={() =>
                                      setFormData(prev => ({...prev, pace: p.id}))
                                  }
                                  className="flex flex-col items-center gap-1 px-3 py-3 rounded-2xl border text-sm font-medium transition-all"
                                  style={
                                    formData.pace === p.id
                                        ? {
                                          backgroundColor: '#1B4332',
                                          color: 'white',
                                          borderColor: '#1B4332',
                                          boxShadow:
                                              '0 10px 22px rgba(27,67,50,0.18)',
                                        }
                                        : {
                                          backgroundColor: '#fdf9f7',
                                          color: '#2d2621',
                                          borderColor: '#ddd9d0',
                                        }
                                  }
                              >
                                <span className="text-lg">{p.emoji}</span>
                                <span className="font-semibold">{p.label}</span>
                                <span
                                    className="text-[11px] text-center"
                                    style={{
                                      color:
                                          formData.pace === p.id
                                              ? 'rgba(255,255,255,0.72)'
                                              : '#6b6460',
                                    }}
                                >
                                {p.hint}
                              </span>
                              </button>
                          ))}
                        </div>
                      </div>

                      {/* Preferences */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium block mb-2"
                            style={{color: '#2d2621'}}
                        >
                          Preferences
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          {INTEREST_OPTIONS.map(opt => (
                              <button
                                  key={opt.id}
                                  onClick={() => toggleInterest(opt.id)}
                                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                                  style={
                                    formData.interests.includes(opt.id)
                                        ? {
                                          backgroundColor: '#1B4332',
                                          color: 'white',
                                          borderColor: '#1B4332',
                                        }
                                        : {
                                          backgroundColor: '#fdf9f7',
                                          color: '#2d2621',
                                          borderColor: '#ddd9d0',
                                        }
                                  }
                              >
                                <span>{opt.emoji}</span>
                                <span>{opt.label}</span>
                              </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="space-y-4">
                      {/* Start time */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium flex items-center gap-1.5 mb-2"
                            style={{color: '#2d2621'}}
                        >
                          <Calendar className="w-3.5 h-3.5"/>
                          Start Time
                        </label>

                        <input
                            type="time"
                            value={formData.start_time}
                            onChange={e =>
                                setFormData(prev => ({
                                  ...prev,
                                  start_time: e.target.value,
                                }))
                            }
                            className="w-full h-10 px-3 rounded-xl border text-sm font-mono-data outline-none"
                            style={{
                              borderColor: '#ddd9d0',
                              backgroundColor: '#fdf9f7',
                              color: '#2d2621',
                            }}
                        />
                      </div>

                      {/* Transport */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium flex items-center gap-1.5 mb-2"
                            style={{color: '#2d2621'}}
                        >
                          <Map className="w-3.5 h-3.5" style={{color: '#1B4332'}}/>
                          Getting Around
                        </label>

                        <div className="grid grid-cols-3 gap-2">
                          {transportOptions.map(m => (
                              <button
                                  key={m.id}
                                  onClick={() =>
                                      setFormData(prev => ({
                                        ...prev,
                                        transport_mode: m.id,
                                      }))
                                  }
                                  className="flex flex-col items-center gap-1 px-3 py-3 rounded-2xl border text-sm font-medium transition-all"
                                  style={
                                    formData.transport_mode === m.id
                                        ? {
                                          backgroundColor: '#C85A2A',
                                          color: 'white',
                                          borderColor: '#C85A2A',
                                          boxShadow:
                                              '0 10px 22px rgba(200,90,42,0.18)',
                                        }
                                        : {
                                          backgroundColor: '#fdf9f7',
                                          color: '#2d2621',
                                          borderColor: '#ddd9d0',
                                        }
                                  }
                              >
                                <span className="text-lg">{m.emoji}</span>
                                <span className="font-semibold">{m.label}</span>
                                <span
                                    className="text-[11px] text-center"
                                    style={{
                                      color:
                                          formData.transport_mode === m.id
                                              ? 'rgba(255,255,255,0.72)'
                                              : '#6b6460',
                                    }}
                                >
                                {m.hint}
                              </span>
                              </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom places */}
                      <div
                          className="rounded-2xl border p-4"
                          style={{backgroundColor: '#fffdfb', borderColor: '#e3ddd5'}}
                      >
                        <label
                            className="text-sm font-medium"
                            style={{color: '#2d2621'}}
                        >
                          Custom Places
                          {formData.manual_places.length > 0 && (
                              <span
                                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-xs"
                                  style={{backgroundColor: '#C85A2A'}}
                              >
                              {formData.manual_places.length}
                            </span>
                          )}
                        </label>

                        <p className="text-xs mt-1 mb-2" style={{color: '#6b6460'}}>
                          Add specific places you want included in your itinerary.
                        </p>

                        <div className="flex gap-2">
                          <input
                              type="text"
                              value={newPlace}
                              onChange={e => setNewPlace(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addManualPlace()}
                              placeholder="e.g. Louvre Museum, Eiffel Tower"
                              className="flex-1 h-10 px-3 rounded-xl border text-sm outline-none"
                              style={{
                                borderColor: '#ddd9d0',
                                backgroundColor: '#fdf9f7',
                                color: '#2d2621',
                              }}
                          />
                          <button
                              onClick={addManualPlace}
                              className="w-10 h-10 rounded-xl border flex items-center justify-center transition-colors"
                              style={{
                                borderColor: '#ddd9d0',
                                backgroundColor: '#fdf9f7',
                                color: '#6b6460',
                              }}
                          >
                            <Plus className="w-4 h-4"/>
                          </button>
                        </div>

                        <AnimatePresence>
                          {formData.manual_places.length > 0 && (
                              <motion.div className="flex flex-wrap gap-2 mt-3">
                                {formData.manual_places.map(place => (
                                    <motion.div
                                        key={place}
                                        initial={{opacity: 0, scale: 0.8}}
                                        animate={{opacity: 1, scale: 1}}
                                        exit={{opacity: 0, scale: 0.8}}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                                        style={{
                                          backgroundColor: 'rgba(27,67,50,0.1)',
                                          color: '#1B4332',
                                        }}
                                    >
                                      <MapPin className="w-3 h-3"/>
                                      {place}
                                      <button
                                          onClick={() => removeManualPlace(place)}
                                          className="ml-0.5 transition-colors"
                                          style={{color: '#1B4332'}}
                                      >
                                        <X className="w-3 h-3"/>
                                      </button>
                                    </motion.div>
                                ))}
                              </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Error */}
                      <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{opacity: 0, height: 0}}
                                animate={{opacity: 1, height: 'auto'}}
                                exit={{opacity: 0, height: 0}}
                                className="rounded-2xl px-4 py-3 text-sm"
                                style={{
                                  backgroundColor: 'rgba(201,69,69,0.08)',
                                  border: '1px solid rgba(201,69,69,0.3)',
                                  color: '#c94545',
                                }}
                            >
                              <strong>Error: </strong>
                              {error}
                            </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Button */}
                      {/* Buttons */}
                      <div className="space-y-3">
                        <motion.button
                            whileHover={!isGenerating ? {scale: 1.01} : {}}
                            whileTap={!isGenerating ? {scale: 0.99} : {}}
                            onClick={handleSubmit}
                            disabled={!formData.destination.trim() || isGenerating}
                            className="w-full h-12 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-sm"
                            style={
                              !formData.destination.trim() || isGenerating
                                  ? {
                                    backgroundColor: '#ebe8e4',
                                    color: '#a89f97',
                                    cursor: 'not-allowed',
                                  }
                                  : {
                                    background:
                                        'linear-gradient(135deg, #1B4332 0%, #24543f 100%)',
                                    color: 'white',
                                  }
                            }
                        >
                          {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin"/>
                                <motion.span
                                  key={loadingMsgIndex}
                                  initial={{opacity: 0, y: 6}}
                                  animate={{opacity: 1, y: 0}}
                                  exit={{opacity: 0, y: -6}}
                                  transition={{duration: 0.35}}
                                >
                                  {LOADING_MESSAGES[loadingMsgIndex]}
                                </motion.span>
                              </>
                          ) : (
                              <>
                                <Sparkles className="w-4 h-4"/>
                                Generate New Itinerary with AI
                              </>
                          )}
                        </motion.button>


                      </div>

                      {isGenerating && (
                          <motion.div
                              initial={{opacity: 0}}
                              animate={{opacity: 1}}
                              className="text-center text-sm font-mono-data"
                              style={{color: '#6b6460'}}
                          >
                            {generationProgress}
                          </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right summary side */}
            <div className="xl:col-span-4">
              <div className="sticky top-4 space-y-4">
                {/* Live summary */}
                <div
                    className="rounded-3xl border shadow-sm p-5"
                    style={{
                      background:
                          'linear-gradient(180deg, rgba(27,67,50,0.98) 0%, rgba(36,84,63,0.96) 100%)',
                      borderColor: 'rgba(27,67,50,0.18)',
                      color: 'white',
                    }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{backgroundColor: 'rgba(255,255,255,0.12)'}}
                    >
                      <Compass className="w-5 h-5 text-white"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Trip Summary</p>
                      <p className="text-xs text-white/70">
                        Your selections update in real time
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div
                        className="rounded-2xl px-4 py-3"
                        style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                    >
                      <p className="text-xs text-white/70 mb-1">Destination</p>
                      <p className="font-semibold">
                        {formData.destination || 'Choose your destination'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div
                          className="rounded-2xl px-4 py-3"
                          style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                      >
                        <p className="text-xs text-white/70 mb-1">Days</p>
                        <p className="font-semibold">{formData.days}</p>
                      </div>

                      <div
                          className="rounded-2xl px-4 py-3"
                          style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                      >
                        <p className="text-xs text-white/70 mb-1">Start Time</p>
                        <p className="font-semibold">{formData.start_time}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div
                          className="rounded-2xl px-4 py-3"
                          style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                      >
                        <p className="text-xs text-white/70 mb-1">Pace</p>
                        <p className="font-semibold">{selectedPace}</p>
                      </div>

                      <div
                          className="rounded-2xl px-4 py-3"
                          style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                      >
                        <p className="text-xs text-white/70 mb-1">Transport</p>
                        <p className="font-semibold">{selectedTransport}</p>
                      </div>
                    </div>

                    <div
                        className="rounded-2xl px-4 py-3"
                        style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                    >
                      <p className="text-xs text-white/70 mb-1">Start Location</p>
                      <p className="font-semibold">
                        {formData.start_location || 'Not added yet'}
                      </p>
                    </div>

                    <div
                        className="rounded-2xl px-4 py-3"
                        style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                    >
                      <p className="text-xs text-white/70 mb-2">Preferences</p>
                      <div className="flex flex-wrap gap-2">
                        {formData.interests.length > 0 ? (
                            formData.interests.map(id => {
                              const item = INTEREST_OPTIONS.find(opt => opt.id === id);
                              return (
                                  <span
                                      key={id}
                                      className="px-2.5 py-1 rounded-full text-xs"
                                      style={{backgroundColor: 'rgba(255,255,255,0.12)'}}
                                  >
                                {item?.emoji} {item?.label}
                              </span>
                              );
                            })
                        ) : (
                            <span className="text-sm text-white/70">
                            No preferences selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                        className="rounded-2xl px-4 py-3"
                        style={{backgroundColor: 'rgba(255,255,255,0.08)'}}
                    >
                      <p className="text-xs text-white/70 mb-1">Custom Places</p>
                      <p className="font-semibold">
                        {formData.manual_places.length} added
                      </p>
                    </div>
                  </div>
                </div>

                {/* Small attractive info card */}
                <div
                    className="rounded-3xl border p-5 shadow-sm"
                    style={{
                      background:
                          'linear-gradient(135deg, rgba(200,90,42,0.10) 0%, rgba(255,253,251,0.96) 75%)',
                      borderColor: '#e3ddd5',
                    }}
                >
                  <div className="flex items-start gap-3">
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                        style={{backgroundColor: 'rgba(200,90,42,0.12)'}}
                    >
                      <Clock3 className="w-5 h-5" style={{color: '#C85A2A'}}/>
                    </div>
                    <div>
                      <p
                          className="font-semibold mb-1"
                          style={{color: '#2d2621'}}
                      >
                        Pro tip
                      </p>
                      <p className="text-sm leading-6" style={{color: '#6b6460'}}>
                        Use voice input to say things like:
                        <span className="font-medium" style={{color: '#2d2621'}}>
                          {' '}
                          “Plan a 4-day Paris trip with food and museums”
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
  );
}