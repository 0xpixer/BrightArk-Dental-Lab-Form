/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#F47B20',
        secondary: '#1E6DBF',
        accent: '#6B4EFF',
        bg: '#F5F6FA',
        surface: '#FFFFFF',
        border: '#E0E3ED',
        text: '#1A1D2E',
        'text-muted': '#6B7280',
        'grey-input': '#e3e3e3',
        'order-green': '#e8f5e9',
      },
      fontFamily: {
        sans: ['"Noto Sans"', 'system-ui', 'sans-serif'],
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
