import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './src/**/*.{html,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        darija: {
          50: '#f5f6ff',
          100: '#eceeff',
          200: '#dbe0ff',
          300: '#bfcbff',
          400: '#9aa9ff',
          500: '#6d7fff',
          600: '#4f5eff', // Vibrant glowing violet-blue
          700: '#3c48e8',
          800: '#313bc2',
          900: '#2c359b',
          950: '#1a1d5c',
        }
      },
      fontFamily: {
        sans: [
          'Manrope',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        'glow-primary': '0 0 15px -3px rgba(79, 94, 255, 0.45)',
        'glow-success': '0 0 15px -3px rgba(16, 185, 129, 0.45)',
        'glow-error': '0 0 15px -3px rgba(239, 68, 68, 0.45)',
      }
    },
  },
  plugins: [],
} satisfies Config;
