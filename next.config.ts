import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for a few resized recipe photos sent as
      // base64 — see photo-import in app/actions/import-recipe.ts.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
