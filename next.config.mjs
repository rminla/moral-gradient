/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Restricted traces and the local DB must never be bundled as static assets.
  outputFileTracingExcludes: { "*": ["./data/*.db", "./data/*.db-*"] },
  // Brand fonts for the generated share images (next/og reads them from disk).
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/fonts/*.ttf"],
    "/try/og": ["./assets/fonts/*.ttf"],
    "/quiz/og": ["./assets/fonts/*.ttf"],
    "/s/quiz/og": ["./assets/fonts/*.ttf"],
    // Results bundles and public funding data read with fs at request time.
    "*": ["./data/v3-preview.json", "./data/v3-bundle.json", "./data/offline-donations.json", "./data/spend-snapshot.json"],
  },
};
export default nextConfig;
