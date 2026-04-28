import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Match game's palette (from blocksworn_index_fixed.html CSS vars)
        gold: {
          100: '#FFE898',
          300: '#FFD53D',
          500: '#FFB84A',
          700: '#E8A02C',
          900: '#9C6A14',
        },
        ember: '#E85D4A',
        tide: '#3B8BD4',
        grove: '#5DCA79',
        solar: '#E8B84A',
        umbra: '#9B59D6',
        bg: {
          dark: '#0A0A1A',
          mid: '#12121E',
          panel: '#1A1A2E',
        },
        text: {
          primary: '#F5F3EC',
          secondary: '#E4E1F0',
          muted: '#B8B5C4',
          dim: '#8A88A0',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Trajan Pro', 'serif'],
        body: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 213, 61, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 213, 61, 0.6)' },
        },
      },
      backgroundImage: {
        'radial-gold': 'radial-gradient(ellipse at top, rgba(255,213,61,0.18) 0%, transparent 60%)',
        'radial-ember': 'radial-gradient(ellipse at top, rgba(232,93,74,0.20) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
};
export default config;
