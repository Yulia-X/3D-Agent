/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'space': {
          900: '#0a0a1a',
          800: '#0f0f2e',
          700: '#151540',
          600: '#1a1a52',
        },
        'neon': {
          blue: '#4fc3f7',
          purple: '#b388ff',
          pink: '#f48fb1',
          green: '#69f0ae',
          cyan: '#00e5ff',
        },
        'glass': {
          light: 'rgba(255, 255, 255, 0.05)',
          medium: 'rgba(255, 255, 255, 0.1)',
          heavy: 'rgba(255, 255, 255, 0.15)',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(79, 195, 247, 0.3), 0 0 40px rgba(79, 195, 247, 0.1)',
        'neon-purple': '0 0 20px rgba(179, 136, 255, 0.3), 0 0 40px rgba(179, 136, 255, 0.1)',
        'neon-green': '0 0 20px rgba(105, 240, 174, 0.3), 0 0 40px rgba(105, 240, 174, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(79, 195, 247, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(79, 195, 247, 0.6)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
