/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens — liquid glass layered hierarchy (sync with main.css)
        surface: {
          DEFAULT: '#1d1d31',            // opaque glass fallback (T7)
          secondary: 'rgb(255 255 255 / 0.06)', // input/button bg
          hover: 'rgb(255 255 255 / 0.10)',
          muted: 'rgb(255 255 255 / 0.04)', // semi-transparent for info sections
          elevated: '#26263c',
        },
        // Semantic text tokens
        text: {
          primary: '#f4f2fb',
          secondary: 'rgb(244 242 251 / 0.6)',
          muted: 'rgb(244 242 251 / 0.5)',
        },
        // Semantic border tokens
        border: {
          DEFAULT: 'rgb(255 255 255 / 0.14)',
          subtle: 'rgb(255 255 255 / 0.10)',
          focus: '#22d3ee',              // cyan-400
        },
        // Accent — cyan, reserved for focus rings / nav-active / semantic feedback
        accent: {
          DEFAULT: '#22d3ee',            // cyan-400
          hover: '#67e8f9',              // cyan-300
          muted: 'rgb(34 211 238 / 0.15)',
          text: '#082026',               // text on accent bg
        },
        // Semantic feedback colors
        feedback: {
          success: '#4ade80',            // green-400
          warning: '#facc15',            // yellow-400
          danger: '#f87171',             // red-400
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
