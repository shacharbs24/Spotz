import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dutiful-slang-flanking.ngrok-free.dev"],
  images: {
    remotePatterns: [
      // Vercel Blob public host: <storeId>.public.blob.vercel-storage.com
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
