import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        usf: {
          green: '#006747',
          'green-dark': '#004d35',
          'green-light': '#e6f2ed',
          gold: '#baa562',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        portal: '0 1px 2px rgba(0, 103, 71, 0.06), 0 8px 24px rgba(0, 103, 71, 0.08)',
        'portal-lg':
          '0 4px 6px rgba(0, 103, 71, 0.05), 0 20px 40px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [typography],
}
