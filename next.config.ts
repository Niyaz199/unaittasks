import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.132"],
  headers: async () => {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      }
    ];
  }
};

export default nextConfig;
