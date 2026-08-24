/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#F47B20',
        secondary: '#171717',
        accent: '#404040',
        bg: '#F7F7F8',
        surface: '#FFFFFF',
        border: '#E5E5E5',
        text: '#171717',
        'text-muted': '#737373',
        'grey-input': '#FFFFFF',
        'order-green': '#F5F5F5',
      },
      fontFamily: {
        sans: ['var(--font-noto-sans)', '"Noto Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
      },
      transitionDuration: {
        brand: '200ms',
      },
      maxWidth: {
        form: '1100px',
      },
    },
  },
  plugins: [],
}
