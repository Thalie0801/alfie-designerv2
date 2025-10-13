/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // (optionnel) Injecte un ID de build à la compilation
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
  },

  // Empêche la détection d’anciens fichiers Pages Router
  // et restreint aux conventions App Router
  pageExtensions: ["page.tsx", "layout.tsx", "route.ts", "middleware.ts"],

  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
