/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Restricted traces and the local DB must never be bundled as static assets.
  outputFileTracingExcludes: { "*": ["./data/*.db", "./data/*.db-*"] },
};
export default nextConfig;
