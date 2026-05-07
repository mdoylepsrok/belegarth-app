/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Belegarth-feel palette: forest, blood, parchment
        forest: {
          900: '#0f1c14',
          800: '#152821',
          700: '#1d3a2f',
          600: '#2a5443'
        },
        blood: {
          600: '#8b1a1a',
          500: '#a82424',
          400: '#c0392b'
        },
        parchment: {
          50: '#f7f3e9',
          100: '#ebe3cc'
        }
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
