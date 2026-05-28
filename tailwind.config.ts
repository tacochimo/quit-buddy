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
        "companion-hop": {
          "0%, 100%": { transform: "translateY(0)" },
          "40%": { transform: "translateY(-22px)" },
        },
        "companion-spin": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.1)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        "companion-wiggle": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-14deg)" },
          "40%": { transform: "rotate(14deg)" },
          "60%": { transform: "rotate(-10deg)" },
          "80%": { transform: "rotate(10deg)" },
        },
        "companion-backflip": {
          "0%": { transform: "translateY(0) rotate(0deg)" },
          "30%": { transform: "translateY(-26px) rotate(-180deg)" },
          "60%": { transform: "translateY(-26px) rotate(-360deg)" },
          "100%": { transform: "translateY(0) rotate(-360deg)" },
        },
        "companion-dance": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "20%": { transform: "translateX(-6px) rotate(-10deg)" },
          "40%": { transform: "translateX(6px) rotate(10deg)" },
          "60%": { transform: "translateX(-4px) rotate(-6deg)" },
          "80%": { transform: "translateX(4px) rotate(6deg)" },
        },
        "companion-dizzy": {
          "0%": { transform: "rotate(0deg) translateX(0)" },
          "25%": { transform: "rotate(180deg) translateX(4px)" },
          "50%": { transform: "rotate(360deg) translateX(-4px)" },
          "75%": { transform: "rotate(540deg) translateX(4px)" },
          "100%": { transform: "rotate(720deg) translateX(0)" },
        },
        "companion-sleep": {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(-20deg) scale(0.95)" },
        },
      },
      animation: {
        "companion-idle": "companion-idle 3.2s ease-in-out infinite",
        "companion-arrive":
          "companion-arrive 700ms cubic-bezier(.2,.7,.3,1.2) forwards",
        "companion-typing": "companion-typing 700ms ease-in-out infinite",
        "companion-celebrate": "companion-celebrate 900ms ease-in-out 3",
        "companion-sparkle": "companion-sparkle 1.4s ease-out forwards",
        "companion-hop": "companion-hop 500ms ease-out",
        "companion-spin": "companion-spin 600ms ease-in-out",
        "companion-wiggle": "companion-wiggle 600ms ease-in-out",
        "companion-backflip": "companion-backflip 800ms ease-in-out",
        "companion-dance": "companion-dance 900ms ease-in-out",
        "companion-dizzy": "companion-dizzy 900ms ease-in-out",
        "companion-sleep": "companion-sleep 1400ms ease-in-out 2",
      },
    },
  },
  plugins: [],
} satisfies Config;
