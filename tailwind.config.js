/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0C1B24",
        mint: "#4BE3AC",
        sun: "#FFD166",
        coral: "#FF6B6B",
        ice: "#E8F6F1",
        fog: "#F2F4F7",
        ocean: "#1F7A8C",
        slate: "#4C5760",
      },
      fontFamily: {
        display: ["SpaceGrotesk_600SemiBold", "System"],
        body: ["Inter_400Regular", "System"],
        bodyMedium: ["Inter_500Medium", "System"],
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
