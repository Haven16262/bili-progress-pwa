/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens — dark theme layered hierarchy
        surface: {
          DEFAULT: '#1e293b',       // slate-800 — card bg
          secondary: '#334155',     // slate-700 — input/button bg
          hover: '#374356',         // slightly lighter than DEFAULT
          muted: 'rgb(30 41 59 / 0.5)', // semi-transparent for info sections
          elevated: '#253349',      // between DEFAULT and secondary
        },
        // Semantic text tokens
        text: {
          primary: '#f1f5f9',       // slate-100
          secondary: '#cbd5e1',     // slate-300
          muted: '#64748b',         // slate-500
        },
        // Semantic border tokens
        border: {
          DEFAULT: '#334155',       // slate-700
          subtle: 'rgb(51 65 85 / 0.5)',
          focus: '#22d3ee',         // cyan-400
        },
        // Accent — cyan primary
        accent: {
          DEFAULT: '#06b6d4',       // cyan-500
          hover: '#22d3ee',         // cyan-400
          muted: 'rgb(6 182 212 / 0.15)',
          text: '#000000',          // text on accent bg
        },
        // Semantic feedback colors
        feedback: {
          success: '#4ade80',       // green-400
          warning: '#facc15',       // yellow-400
          danger: '#f87171',        // red-400
        },
      },
      borderRadius: {
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-normal) var(--ease-out) forwards',
        'fade-in-up': 'fade-in-up var(--duration-slow) var(--ease-out) forwards',
        'scale-in': 'scale-in var(--duration-normal) var(--ease-out) forwards',
      },
    },
  },
  plugins: [],
}
