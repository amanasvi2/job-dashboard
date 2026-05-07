/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          400: '#6b8cff',
          500: '#4d6fff',
          600: '#3654e8',
          700: '#2a42c0',
        },
      },
    },
  },
  plugins: [],
};
