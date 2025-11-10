import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/integrations/supabase/client": path.resolve(
        __dirname,
        "./src/lib/supabaseClient.tsx"
      ),
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
}));
