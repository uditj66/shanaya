import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Component-level rendering: static shells (SSG/ISR via `use cache` + cacheTag) with dynamic parts streamed in <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  // Automatic memoisation; no hand-written useMemo/useCallback needed.
  reactCompiler: true,
  // Broken internal links fail the type check.
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "radix-ui"],
  },
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
