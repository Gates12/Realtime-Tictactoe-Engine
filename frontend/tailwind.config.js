/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: '#0a0a0f',
        surface: '#12121a',
        card: '#1a1a26',
        border: '#2a2a3e',
        accent: '#7c6af7',
        'accent-dim': '#4d3fd4',
        glow: '#a89cf7',
        x: '#f7706a',
        o: '#6af7c8',
        muted: '#6b6b8a',
      },
      boxShadow: {
        glow: '0 0 20px rgba(124,106,247,0.4)',
        'glow-x': '0 0 20px rgba(247,112,106,0.4)',
        'glow-o': '0 0 20px rgba(106,247,200,0.4)',
      },
    },
  },
  plugins: [],
}
