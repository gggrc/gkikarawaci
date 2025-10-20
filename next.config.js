import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  serverExternalPackages: ["@prisma/client"],

  experimental: {
    esmExternals: "loose",
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com", // ✅ Izinkan gambar dari Clerk
      },
    ],
  },
};

export default config;
