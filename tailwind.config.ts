import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "companion-idle": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-2px) scale(1.03)" },
        },
        "companion-arrive": {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.6)" },
          "60%": { opacity: "1", transform: "translateY(-4px) scale(1.05)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "companion-typing": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "25%": { transform: "translateY(-3px) rotate(-4deg)" },
          "75%": { transform: "translateY(-3px) rotate(4deg)" },
        },
        "companion-celebrate": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "20%": { transform: "translateY(-14px) rotate(-12deg)" },
          "40%": { transform: "translateY(-6px) rotate(0deg)" },
          "60%": { transform: "translateY(-16px) rotate(12deg)" },
          "80%": { transform: "translateY(-4px) rotate(0deg)" },
        },
        "companion-sparkle": {
          "0%": { opacity: "0", transform: "translateY(0) scale(0.4)" },
          "30%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-30px) scale(1.1)" },
        },
      },
      animation: {
        "companion-idle": "companion-idle 3.2s ease-in-out infinite",
        "companion-arrive":
          "companion-arrive 700ms cubic-bezier(.2,.7,.3,1.2) forwards",
        "companion-typing": "companion-typing 700ms ease-in-out infinite",
        "companion-celebrate": "companion-celebrate 900ms ease-in-out 3",
        "companion-sparkle": "companion-sparkle 1.4s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
