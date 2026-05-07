/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "The Park" palette — daylight, grass, warm sun
        grass: {
          50: '#f1f9ed',
          100: '#dff1d5',
          200: '#bde4ab',
          500: '#5fa83a',
          600: '#4a8a2a',
          700: '#3a6e21',
          900: '#1f3d12'
        },
        sun: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706'
        },
        sky: {
          50: '#eff8ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb'
        },
        cream: {
          50: '#fffdf7',
          100: '#fef9e7',
          200: '#fdf3cc'
        },
        ink: {
          700: '#374151',
          800: '#1f2937',
          900: '#111827'
        }
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
