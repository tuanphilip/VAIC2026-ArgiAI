const apiOrigin = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://argiai-api.54.254.159.139.sslip.io")
  .replace(/\/$/, "")
  .replace(/\/api\/v1$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
