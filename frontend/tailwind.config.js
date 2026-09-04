/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          void: "#0B0D13",       // Deep Canvas Background
          card: "#13161F",       // Surface Container Background
          hover: "#1A1F2C",      // Hover Card Surface
          border: "#1F2433",     // Subtle 1px Divider
          borderFocus: "#2D344B",// Focused input border
        },
        brand: {
          DEFAULT: "#3B82F6",    // Electric KeyAuth Blue
          hover: "#2563EB",      // Deep Accent Blue
          glow: "rgba(59, 130, 246, 0.15)",
        },
        status: {
          success: "#10B981",    // Emerald Green
          warning: "#F59E0B",    // Amber Gold
          danger: "#EF4444",     // Crimson Red
          info: "#06B6D4",       // Cyan
        },
        text: {
          primary: "#F3F4F6",    // Crisp White
          secondary: "#9CA3AF",  // Muted Slate Grey
          muted: "#6B7280",      // Darker Grey
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
}
