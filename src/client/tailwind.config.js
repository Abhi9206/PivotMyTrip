/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Organic Expedition Palette (matching WanderAI) ── */
        background: '#f5f3f0',        // warm stone
        foreground: '#2d2621',        // near-black warm
        card:       '#fdf9f7',        // off-white card
        border:     '#ddd9d0',        // subtle warm border
        muted:      '#ebe8e4',        // muted bg
        'muted-fg': '#6b6460',        // muted text

        forest: {                     // primary — deep forest green
          DEFAULT: '#1B4332',
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          light: '#2d6a4f',
          dark:  '#122b22',
        },
        terra: {                      // accent — terracotta
          DEFAULT: '#C85A2A',
          50:  '#fdf3ee',
          100: '#fae2d1',
          200: '#f5c2a3',
          300: '#ee9b6b',
          400: '#e87443',
          500: '#C85A2A',
          600: '#a84520',
          700: '#8a341a',
          800: '#722c18',
          900: '#5f2517',
        },
        sand:  '#ede9e0',             // secondary/sand
        stone: '#f5f3f0',             // page background
        sidebar: {
          DEFAULT:  '#122b22',        // dark forest sidebar
          accent:   '#1d3d2f',
          border:   '#1d3d2f',
          fg:       '#e8e6e3',
        },

        /* ── Keep nomad scale for backward compatibility ── */
        nomad: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f5deb3',
          300: '#efc97a',
          400: '#e8a740',
          500: '#d4861e',
          600: '#b86a14',
          700: '#934f12',
          800: '#773f15',
          900: '#633515',
        },
      },

      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans:    ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },

      animation: {
        'pulse-slow':     'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle':  'bounce 2s infinite',
        'fade-in':        'fadeIn 0.3s ease forwards',
        'slide-up':       'slideUp 0.4s ease forwards',
      },

      keyframes: {
        fadeIn:  { from: { opacity: 0 },                        to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },

      boxShadow: {
        'card':   '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-md':'0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
      },

      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
}
