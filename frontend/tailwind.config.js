/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f172a', // Fundo principal
          800: '#1e293b', // Cards
          700: '#334155', // Bordas
        },
        emerald: {
          400: '#34d399', // Verde do Lucro
          500: '#10b981',
        }
      }
    },
  },
  plugins: [],
}