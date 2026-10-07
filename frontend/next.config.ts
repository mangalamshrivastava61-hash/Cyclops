import type { NextConfig } from "next";

/** Where the ORACLE API (backend/) runs. The browser reaches it through the /api rewrite below. */
const API_URL = process.env.ORACLE_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
