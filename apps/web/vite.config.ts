import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (names: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3090",
    },
  },
  preview: {
    proxy: {
      "/api": "http://localhost:3090",
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
