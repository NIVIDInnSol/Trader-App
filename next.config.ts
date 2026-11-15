import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here depends on the signed-in user, so pages render per request.
  // Cache Components is left off for this first version to keep that simple.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
