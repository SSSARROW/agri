import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async redirects() {
    return [
      { source: "/login", destination: "/signin", permanent: false },
      { source: "/register", destination: "/signup", permanent: false },
    ];
  },
};

export default nextConfig;
