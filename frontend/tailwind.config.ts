import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F5F0EB',
          deep: '#EDE3D4',
        },
        card: {
          DEFAULT: '#FFFFFF',
          tint: '#FAF4EC',
        },
        ink: {
          DEFAULT: '#2E1F18',
          2: '#5A4338',
        },
        mute: {
          DEFAULT: '#8C7A6E',
          2: '#B7A89D',
        },
        line: {
          DEFAULT: '#E5DACC',
          2: '#EFE5D5',
          strong: '#CDB9A2',
        },
        sage: {
          DEFAULT: '#CE6A49',
          deep: '#B94A3E',
          soft: '#F0DCCA',
          'soft-2': '#D9BBA7',
        },
        amber: {
          DEFAULT: '#7F5A44',
          soft: '#ECDBC6',
        },
        clay: {
          DEFAULT: '#7F5A44',
          soft: '#EBD8C5',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '18px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 0 rgba(46,31,24,0.04), 0 1px 2px rgba(46,31,24,0.04)',
        md: '0 1px 0 rgba(46,31,24,0.04), 0 8px 24px -12px rgba(46,31,24,0.18)',
        lg: '0 1px 0 rgba(46,31,24,0.04), 0 28px 64px -28px rgba(46,31,24,0.32)',
      },
    },
  },
  plugins: [],
};

export default config;
