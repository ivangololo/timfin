/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Montserrat"', 'ui-sans-serif', 'system-ui'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          DEFAULT: '#0284c7',
          dark: '#0369a1',
          light: '#38bdf8',
          neon: '#22d3ee',
        },
        accent: {
          DEFAULT: '#7c3aed',
          soft: '#a855f7',
          vivid: '#ec4899',
        },
        slateGlass: '#0f172a',
      },
      boxShadow: {
        panel: '0 20px 45px -20px rgba(30,64,175,0.45)',
      },
    },
  },
  plugins: [],
};
