/** @type {import('next').NextConfig} */
const nextConfig = {
  // On ignore toutes les extensions classiques pour le Pages Router,
  // ce qui neutralise src/pages/** sans les supprimer
  pageExtensions: ["pagex"],
  experimental: { appDir: true },
};

module.exports = nextConfig;
