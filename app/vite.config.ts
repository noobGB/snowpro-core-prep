import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Serves the content pipeline's output (../content/content.json, ../content/notes/*.json,
// ../content/search-index.json) at the site root, so the SPA can fetch it without a copy step.
// The eventual Docker setup (spec §9) will serve these from /app/dist the same way.
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(import.meta.dirname, "../content"),
});
