/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js",
    "./public/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        earth: {
          50: "#FAFAF5",
          100: "#F5F5EB",
          200: "#E6E6D6",
          400: "#A89880",
          500: "#8A7560",
          600: "#6F5D48",
          800: "#5D4E37",
          900: "#3E3328",
        },
        brand: {
          brown: "#8B5E3C",
          gold: "#C5A059",
          light: "#FDFBF7",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "serif"],
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
