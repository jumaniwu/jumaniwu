import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // disabled to prevent double-mount of WS connections
};

export default nextConfig;
