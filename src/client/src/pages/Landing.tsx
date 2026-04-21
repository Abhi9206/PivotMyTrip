// PivotMyTrip Landing Page — Organic Expedition Theme
// Warm stone bg · forest green primary · terracotta accent
// Fraunces display · DM Sans body · JetBrains Mono data

import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { MapPin, Zap, Route, Clock, RefreshCw, Database, Mic } from 'lucide-react';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=80';
const CITY_IMAGE_1 =
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80'; // Paris
const CITY_IMAGE_2 =
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80'; // Tokyo

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Planning',
    desc: 'Groq LLM generates personalized itineraries in seconds, clustered by neighborhood for efficient routing.',
  },
  {
    icon: MapPin,
    title: 'Live Interactive Map',
    desc: 'All locations plotted on a real Voyager map with route visualization and proximity detection.',
  },
  {
    icon: Clock,
    title: 'Real-Time Tracking',
    desc: 'GPS simulation tracks your journey. Auto check-in triggers when you arrive at each location.',
  },
  {
    icon: RefreshCw,
    title: 'Mid-Day Replanning',
    desc: 'Tired? Running late? The AI replans your remaining day from your current position instantly.',
  },
  {
    icon: Route,
    title: 'Smart Route Clustering',
    desc: 'Places are grouped by neighborhood and ordered to minimize real road travel time between stops.',
  },
  {
    icon: Mic,
    title: 'Voice Commands',
    desc: 'Speak naturally - Groq Whisper transcribes and understands your voice to update your trip.',
  },
  {
    icon: Database,
    title: 'Intelligent Caching',
    desc: 'Popular destinations load instantly from cache, no waiting for repeated itinerary generation.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f3f0' }}>
      {/* ── Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          backgroundColor: 'rgba(245,243,240,0.85)',
          backdropFilter: 'blur(12px)',
          borderColor: '#ddd9d0',
        }}
      >
        <div className="w-full max-w-[1500px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#1B4332' }}
            >
              <MapPin className="w-4 h-4 text-white" />
            </div>

            <div className="flex items-baseline gap-3">
              <span
                className="font-display text-2xl font-semibold tracking-tight"
                style={{ color: '#2d2621' }}
              >
                PivotMyTrip
              </span>

              <span
                className="hidden md:block text-sm"
                style={{ color: '#1B4332' }}
              >
                ✨ Plans change. Your trip can too.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/plan">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ backgroundColor: '#1B4332' }}
              >
                Sign Up
              </motion.button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Travel"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(45,38,33,0.82) 0%, rgba(45,38,33,0.52) 50%, transparent 100%)',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-12 lg:px-20 py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          {/* Left text block */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Plan Less.
              <br />
              <span style={{ color: '#e07847' }}>Experience More.</span>
            </h1>

            <p
              className="text-lg mb-4 max-w-lg leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            >
              No more overplanning or last-minute chaos.
            </p>

            <p
              className="text-lg mb-8 max-w-lg leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.82)' }}
            >
              PivotMyTrip guides your journey with smart itineraries powered by AI, real-time
              updates, and seamless adjustments — all brought together in one
              live, interactive map.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/plan">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3 rounded-lg text-white font-semibold text-base transition-all"
                  style={{ backgroundColor: '#C85A2A' }}
                >
                  Start Planning
                </motion.button>
              </Link>

              <Link href="/review">
  <motion.button
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    className="px-6 py-3 rounded-lg font-semibold text-base transition-all"
    style={{
      border: '1px solid rgba(255,255,255,0.4)',
      color: 'white',
      backgroundColor: 'transparent',
    }}
  >
    Review Itinerary
  </motion.button>
</Link>

              <Link href="/live">
  <motion.button
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    className="px-6 py-3 rounded-lg font-semibold text-base transition-all"
    style={{
      border: '1px solid rgba(255,255,255,0.4)',
      color: 'white',
      backgroundColor: 'transparent',
    }}
  >
    Track Live
  </motion.button>
</Link>
            </div>

            <div className="flex items-center gap-6 mt-12">
              {[
                ['AI-Powered', 'Groq LLM'],
                ['Real-Time', 'GPS Sim'],
                ['Smart Cache', 'Instant Load'],
              ].map(([label, sub]) => (
                <div key={label}>
                  <div className="text-white font-semibold text-sm">{label}</div>
                  <div
                    className="text-xs font-mono-data"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right demo preview block */}
          <motion.div
            className="hidden lg:block w-full relative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0, y: 10 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
          >
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)',
                height: '430px',
                backgroundColor: '#2d2621',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                transform: 'translateY(10px)',
              }}
            >
              <img
                src={HERO_IMAGE}
                alt="PivotMyTrip Demo Preview"
                className="w-full h-full object-cover"
              />

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to top, rgba(45,38,33,0.30), rgba(45,38,33,0.10))',
                }}
              />

              <div className="absolute top-4 left-4 z-10">
                <div
                  className="px-4 py-2.5 rounded-full flex items-center gap-3 shadow-sm"
                  style={{
                    backgroundColor: 'rgba(243,241,237,0.95)',
                    color: '#2d2621',
                    border: '1px solid #ddd9d0',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#1B4332' }}
                  >
                    <MapPin className="w-4 h-4 text-white" />
                  </div>

                  <span className="text-sm font-semibold">PivotMyTrip</span>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center z-10">
                <motion.button
  onClick={() =>
    window.open(
      "\n" +
        "https://www.youtube.com/watch?v=lQJ7_jclZ-k",
      "_blank"
    )
  }
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-7 py-4 rounded-full text-white font-semibold shadow-xl flex items-center gap-3"
                  style={{
                    backgroundColor: '#C85A2A',
                    border: '2px solid rgba(255,255,255,0.35)',
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 10px 30px rgba(200,90,42,0.5)',
                  }}
                >
                  <span className="text-base">▶</span>
                  <span className="text-base">Watch Demo</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24" style={{ backgroundColor: '#f5f3f0' }}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="font-display text-4xl font-bold mb-4"
              style={{ color: '#2d2621' }}
            >
              Everything a Smart Traveler Needs
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: '#6b6460' }}
            >
              From AI-generated itineraries to real-time GPS tracking, voice
              commands, and intelligent replanning .PivotMyTrip handles the
              logistics so you can focus on the experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="rounded-xl p-6 transition-shadow hover:shadow-card-md"
                style={{
                  backgroundColor: '#fdf9f7',
                  border: '1px solid #ddd9d0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(27,67,50,0.1)' }}
                >
                  <f.icon className="w-5 h-5" style={{ color: '#1B4332' }} />
                </div>
                <h3
                  className="font-semibold mb-2"
                  style={{ color: '#2d2621' }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: '#6b6460' }}
                >
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Destinations showcase ── */}
      <section
        className="py-24"
        style={{ backgroundColor: 'rgba(237,233,224,0.45)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2
                className="font-display text-4xl font-bold mb-4"
                style={{ color: '#2d2621' }}
              >
                Works for Any Destination
              </h2>
              <p
                className="text-lg mb-6 leading-relaxed"
                style={{ color: '#6b6460' }}
              >
                Whether you're exploring the romantic streets of Paris or the
                neon-lit alleys of Tokyo, PivotMyTrip crafts a personalized
                itinerary that respects your pace and preferences.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  'Paris',
                  'Tokyo',
                  'New York',
                  'Barcelona',
                  'Rome',
                  'Bangkok',
                  'Amsterdam',
                  'Dubai',
                ].map((city) => (
                  <Link key={city} href="/plan">
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all"
                      style={{
                        backgroundColor: '#fdf9f7',
                        border: '1px solid #ddd9d0',
                        color: '#6b6460',
                      }}
                    >
                      {city}
                    </span>
                  </Link>
                ))}
              </div>

              <Link href="/plan">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-2.5 rounded-lg text-white font-semibold transition-all"
                  style={{ backgroundColor: '#1B4332' }}
                >
                  Try it Now
                </motion.button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                className="rounded-xl overflow-hidden"
                style={{ aspectRatio: '3/4' }}
              >
                <img
                  src={CITY_IMAGE_1}
                  alt="Paris"
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="rounded-xl overflow-hidden mt-8"
                style={{ aspectRatio: '3/4' }}
              >
                <img
                  src={CITY_IMAGE_2}
                  alt="Tokyo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24" style={{ backgroundColor: '#f5f3f0' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <motion.h2
            className="font-display text-4xl font-bold mb-16"
            style={{ color: '#2d2621' }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            How PivotMyTrip Works
          </motion.h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Set Your Destination',
                desc: "Tell us where you're going and for how long.",
              },
              {
                step: '02',
                title: 'AI Generates Plan',
                desc: 'Groq LLM creates a tailored itinerary in seconds.',
              },
              {
                step: '03',
                title: 'Route Optimized',
                desc: 'OSRM calculates real walking distances between stops.',
              },
              {
                step: '04',
                title: 'Live Navigation',
                desc: 'Simulate your trip or follow it in real time.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className="font-display text-4xl font-bold mb-3"
                  style={{ color: 'rgba(27,67,50,0.22)' }}
                >
                  {item.step}
                </div>
                <h4
                  className="font-semibold mb-2"
                  style={{ color: '#2d2621' }}
                >
                  {item.title}
                </h4>
                <p className="text-sm" style={{ color: '#6b6460' }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="py-24 text-white"
        style={{ backgroundColor: '#1B4332' }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl font-bold mb-4">
            Ready to Wander Smarter?
          </h2>
          <p
            className="text-lg mb-8"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          >
            Enter your destination and let AI plan your perfect trip in seconds.
          </p>

          <Link href="/plan">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-10 py-3 rounded-lg font-semibold text-white text-base transition-all"
              style={{ backgroundColor: '#C85A2A' }}
            >
              Plan My Trip
            </motion.button>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t" style={{ borderColor: '#ddd9d0' }}>
        <div
          className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm"
          style={{ color: '#6b6460' }}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span
              className="font-display font-semibold"
              style={{ color: '#2d2621' }}
            >
              PivotMyTrip
            </span>
            <span>— Real-Time Travel Planner</span>
          </div>
          <span className="font-mono-data text-xs">
            Prototype v2.0 · Powered by Groq
          </span>
        </div>
      </footer>
    </div>
  );
}