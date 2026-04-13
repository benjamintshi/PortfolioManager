/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--arena-font-body)'],
        display: ['var(--arena-font-display)'],
        data: ['var(--arena-font-data)'],
        mono: ['var(--arena-font-mono)'],
      },
      colors: {
        // Arena semantic
        arena: {
          void: 'var(--arena-bg-void)',
          base: 'var(--arena-bg-base)',
          surface: 'var(--arena-bg-surface)',
          elevated: 'var(--arena-bg-elevated)',
          panel: 'var(--arena-bg-panel)',
          hover: 'var(--arena-bg-hover)',
        },
        primary: {
          DEFAULT: 'var(--arena-primary)',
          dim: 'var(--arena-primary-dim)',
          soft: 'var(--arena-primary-soft)',
        },
        accent: {
          DEFAULT: 'var(--arena-accent)',
          dim: 'var(--arena-accent-dim)',
          soft: 'var(--arena-accent-soft)',
        },
        success: {
          DEFAULT: 'var(--arena-success)',
          soft: 'var(--arena-success-soft)',
        },
        danger: {
          DEFAULT: 'var(--arena-danger)',
          soft: 'var(--arena-danger-soft)',
        },
        hot: {
          DEFAULT: 'var(--arena-hot)',
          soft: 'var(--arena-hot-soft)',
        },
        neutral: {
          50: 'var(--arena-neutral-50)',
          100: 'var(--arena-neutral-100)',
          200: 'var(--arena-neutral-200)',
          300: 'var(--arena-neutral-300)',
          400: 'var(--arena-neutral-400)',
          500: 'var(--arena-neutral-500)',
          600: 'var(--arena-neutral-600)',
          700: 'var(--arena-neutral-700)',
          800: 'var(--arena-neutral-800)',
        },
        // Legacy compat (旧页面迁移前)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Portfolio categories
        crypto: { DEFAULT: '#f7931e', light: '#ffa94d', dark: '#e8710a' },
        stock: { DEFAULT: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        gold: { DEFAULT: '#facc15', light: '#fde047', dark: '#eab308' },
        profit: 'var(--arena-success)',
        loss: 'var(--arena-danger)',
        // Chart
        chart: {
          1: 'var(--arena-chart-1)',
          2: 'var(--arena-chart-2)',
          3: 'var(--arena-chart-3)',
          4: 'var(--arena-chart-4)',
          5: 'var(--arena-chart-5)',
          6: 'var(--arena-chart-6)',
          7: 'var(--arena-chart-7)',
        },
      },
      borderRadius: {
        sm: 'var(--arena-radius-sm)',
        md: 'var(--arena-radius-md)',
        lg: 'var(--arena-radius-lg)',
        xl: 'var(--arena-radius-xl)',
      },
      boxShadow: {
        'arena-sm': 'var(--arena-shadow-sm)',
        'arena-md': 'var(--arena-shadow-md)',
        'arena-lg': 'var(--arena-shadow-lg)',
        'glow-sm': 'var(--arena-shadow-glow-sm)',
        'glow-md': 'var(--arena-shadow-glow-md)',
        'glow-lg': 'var(--arena-shadow-glow-lg)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 #10b98180' },
          '70%': { boxShadow: '0 0 0 10px #10b98100' },
          '100%': { boxShadow: '0 0 0 0 #10b98100' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
      },
      transitionTimingFunction: {
        'arena-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'arena-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
