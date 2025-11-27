import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Some reverse proxies double-apply compression and cause `ERR_CONTENT_DECODING_FAILED`
// in browsers. Stripping the header keeps the dev/preview server responses simple so
// the browser does not attempt to decode content that was never compressed.
const disableCompression = (): Plugin => ({
  name: "disable-compression-headers",
  configureServer(server) {
    server.middlewares.use((_, res, next) => {
      res.removeHeader("Content-Encoding");
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_, res, next) => {
      res.removeHeader("Content-Encoding");
      next();
    });
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [
    disableCompression(),
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/lib/supabase.ts"),
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
}));
