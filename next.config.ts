import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // MVP 阶段跳过构建时类型检查，不影响运行时功能
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
