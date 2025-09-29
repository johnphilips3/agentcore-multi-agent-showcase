/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'amazon-ember': ['Amazon Ember', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
