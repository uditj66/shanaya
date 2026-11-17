import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is fully per-user and dynamic, so we use the classic request-time rendering model.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // The public widget page is embedded in salons' websites via an iframe.
        source: "/w/:slug*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
