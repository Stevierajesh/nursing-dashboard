import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
    // strictPort: fail loudly rather than drifting to the next free
  // port. A silent move puts the app outside the API's CORS
  // allowlist, which surfaces as confusing fetch failures.
  server: { port: 5174, strictPort: true },
});
