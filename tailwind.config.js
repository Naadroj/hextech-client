/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Fonds ──
        hextech: {
          black: '#010a13',
          bg: '#091428',
          bg2: '#0a1428',
          blue: '#0a323c',
          panel: '#0a1a2f',
          gun: '#1e2328', // gunmetal : remplissage bouton / panneau
          gun2: '#1e2933',
          grey: '#3c3c41',
        },
        // ── Or / bronze (rampe du vrai client) ──
        gold: {
          50: '#f7f0df',
          100: '#f0e6d2', // texte le plus clair
          200: '#cdbe91', // texte or moyen
          300: '#c8aa6e', // bordure claire
          400: '#c89b3c', // accent principal
          500: '#b88a46',
          600: '#785a28', // bordure sombre
          700: '#5b5a56', // or désaturé
          800: '#463714',
          900: '#32270f',
        },
        parchment: '#a09b8c', // texte secondaire
        disabled: '#5c5b57',
        // ── Accents magiques / cyan Hextech ──
        rune: {
          deep: '#005a82',
          dark: '#0a323c',
          cyan: '#0acbe6',
          teal: '#0ac8b9',
          hero: '#0397ab',
          edge1: '#08abac',
          edge2: '#01698b',
          text: '#cdfafa',
        },
        // ── Statuts ──
        danger: '#c6403b',
        decline: '#c6403b',
        warn: '#f0b232',
        ok: '#0acb70',
        win: '#0acb70',
      },
      fontFamily: {
        display: ['"Beaufort for LOL"', 'BeaufortforLOL', 'Cinzel', 'Georgia', 'serif'],
        body: ['Spiegel', 'Barlow', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        hex: '0.08em',
        hexwide: '0.18em',
      },
      boxShadow: {
        'glow-gold': '0 0 8px rgba(200,155,60,.55), 0 0 2px rgba(240,230,210,.4)',
        'glow-cyan': '0 0 12px rgba(10,200,230,.55), 0 0 3px rgba(205,250,250,.9)',
        'inset-dark': 'inset 0 0 24px rgba(0,0,0,.6)',
        frame: '0 0 0 1px rgba(1,10,19,.48), 0 2px 14px 2px rgba(0,0,0,.55)',
        'btn-hover': 'inset 0 0 6px 2px rgba(205,250,250,.22), 0 0 10px rgba(200,155,60,.4)',
      },
      backgroundImage: {
        'gold-bar':
          'linear-gradient(90deg,#463714 0%,#785a28 22%,#c8aa6e 50%,#785a28 78%,#463714 100%)',
        'gold-btn':
          'linear-gradient(180deg,#c8aa6e 0%,#c8a355 28%,#c89c3c 46%,#a17b32 72%,#785b28 100%)',
        'gold-edge': 'linear-gradient(to top,#785b28 0%,#c89c3c 55%,#c8a355 71%,#c8aa6e 100%)',
        'cyan-edge': 'linear-gradient(to top,#005a82 0%,#0397ab 50%,#0ac8b9 100%)',
        'panel-grad': 'linear-gradient(180deg,#0a1a2f 0%,#091428 55%,#010a13 100%)',
        'gun-grad': 'linear-gradient(180deg,#1e2328 0%,#161b20 100%)',
      },
      keyframes: {
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 4px rgba(200,155,60,.4)' },
          '50%': { boxShadow: '0 0 16px rgba(200,155,60,.85)' },
        },
        readyFlash: {
          '0%,100%': { boxShadow: '0 0 10px rgba(10,200,230,.5)' },
          '50%': { boxShadow: '0 0 28px rgba(10,200,230,1)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-20deg)', opacity: '0' },
          '10%': { opacity: '.9' },
          '100%': { transform: 'translateX(220%) skewX(-20deg)', opacity: '0' },
        },
        clickpop: {
          '0%': { transform: 'scale(.94)' },
          '60%': { transform: 'scale(1.01)' },
          '100%': { transform: 'scale(1)' },
        },
        splashIn: {
          from: { opacity: '0', transform: 'scale(1.04)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        framePulse: {
          '0%,100%': { borderColor: 'rgba(200,170,110,.35)' },
          '50%': { borderColor: 'rgba(200,170,110,.9)' },
        },
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'ready-flash': 'readyFlash 1s ease-in-out infinite',
        sheen: 'sheen .7s ease-out',
        clickpop: 'clickpop .18s ease-out',
        'splash-in': 'splashIn 1.1s ease-out',
        'frame-pulse': 'framePulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
