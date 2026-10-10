import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // read VITE_* variables from the repo-root .env (the same file the server uses)
  envDir: "../..",
  server: {
    port: 5173,
  },
});
