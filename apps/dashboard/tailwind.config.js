/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "primary": "#ffb1c2",
        "primary-container": "#ff3b81",
        "secondary": "#ffb0cf",
        "secondary-container": "#7d2a53",
        "surface": "#131317",
        "surface-container-lowest": "#0e0e12",
        "surface-container-low": "#151419",
        "surface-container": "#1b1b20",
        "surface-container-high": "#24232a",
        "surface-container-highest": "#353439",
        "on-surface": "#e4e1e7",
        "on-surface-variant": "#d4b8be",
        "outline": "#aa888e",
        "outline-variant": "#5a4045",
        "primary-fixed-dim": "#ffb1c2",
      },
      fontFamily: {
        headline: ["Syne", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        body: ["Inter", "sans-serif"],
        script: ["Caveat", "cursive"],
        gasoek: ["Gasoek One", "sans-serif"],
        pixel: ["Press Start 2P", "monospace"],
      },
    },
  },
  plugins: [],
};
