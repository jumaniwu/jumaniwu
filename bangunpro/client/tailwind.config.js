/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#F5A623',
        'primary-dark': '#E09512',
        navy: '#1A1A2E',
        'sidebar-bg': '#16213E',
        'sidebar-active': '#F5A623',
        'main-bg': '#F8F9FA',
        success: '#28A745',
        danger: '#DC3545',
        warning: '#FD7E14',
        border: '#E9ECEF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
