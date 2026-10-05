import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (names: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`);

// The API server for dev and preview. STRIKE_API points elsewhere, e.g. a second server on another port.
const api = process.env.STRIKE_API ?? "http://localhost:3090";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": api,
    },
  },
  preview: {
    proxy: {
      "/api": api,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Stable vendor code in its own cacheable chunks. Packages are named explicitly so lazily
        // loaded ones (recharts on Progress) stay in their route chunk.
        codeSplitting: {
          groups: [
            { name: "react", test: pkg("react|react-dom|scheduler|react-router|cookie|set-cookie-parser") },
            { name: "motion", test: pkg("motion|framer-motion|motion-dom|motion-utils") },
            { name: "data", test: pkg("@tanstack|zod") },
          ],
        },
      },
    },
  },
});
