/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hextech: {
          black: '#010a13',
          bg: '#091428',
          bg2: '#0a1428',
          panel: '#0a1a2f',
        },
        gold: {
          100: '#f0e6d2',
          300: '#c8aa6e',
          400: '#c89b3c',
          600: '#785a28',
          800: '#463714',
        },
        rune: {
          deep: '#005a82',
          cyan: '#0acbe6',
          hero: '#0397ab',
        },
        danger: '#c6403b',
        ok: '#0acb70',
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        body: ['Spiegel', 'Barlow', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 8px rgba(200,155,60,.55), 0 0 2px rgba(240,230,210,.4)',
        'glow-cyan': '0 0 10px rgba(10,203,230,.6), 0 0 3px rgba(10,203,230,.9)',
        'inset-dark': 'inset 0 0 24px rgba(0,0,0,.6)',
      },
      backgroundImage: {
        'gold-bar':
          'linear-gradient(90deg,#463714 0%,#785a28 25%,#c8aa6e 50%,#785a28 75%,#463714 100%)',
        'gold-btn': 'linear-gradient(180deg,#c8aa6e 0%,#785a28 100%)',
        'panel-grad': 'linear-gradient(180deg,#0a1a2f 0%,#091428 60%,#010a13 100%)',
      },
      keyframes: {
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 4px rgba(200,155,60,.4)' },
          '50%': { boxShadow: '0 0 14px rgba(200,155,60,.85)' },
        },
        readyFlash: {
          '0%,100%': { boxShadow: '0 0 8px rgba(10,203,230,.5)' },
          '50%': { boxShadow: '0 0 26px rgba(10,203,230,1)' },
        },
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'ready-flash': 'readyFlash 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
