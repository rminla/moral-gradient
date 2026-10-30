/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Restricted traces and the local DB must never be bundled as static assets.
  outputFileTracingExcludes: { "*": ["./data/*.db", "./data/*.db-*"] },
  // Brand fonts for the generated share images (next/og reads them from disk).
  outputFileTracingIncludes: { "/opengraph-image": ["./assets/fonts/*.ttf"], "/f/[id]/opengraph-image": ["./assets/fonts/*.ttf"] },
};
export default nextConfig;
