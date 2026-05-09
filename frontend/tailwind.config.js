/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Clash Display', 'system-ui', 'sans-serif'],
        body: ['Satoshi', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0A0A0F',
          50: '#F0F0F5',
          100: '#E0E0EB',
          200: '#C1C1D7',
          300: '#9898BA',
          400: '#6E6E9D',
          500: '#4A4A7A',
          600: '#333360',
          700: '#1E1E48',
          800: '#141430',
          900: '#0A0A1E',
        },
        volt: {
          DEFAULT: '#C4F135',
          50: '#F6FDE0',
          100: '#EDFAC0',
          200: '#DBF483',
          300: '#C4F135',
          400: '#A8D420',
          500: '#89AE18',
        },
        azure: {
          DEFAULT: '#4B8EFF',
          50: '#EEF3FF',
          100: '#D7E5FF',
          200: '#AECBFF',
          300: '#7AABFF',
          400: '#4B8EFF',
          500: '#2670FF',
        },
        coral: '#FF6B6B',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
