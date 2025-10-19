import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  // ❌ Hapus turbo
  // experimental: {
  //   turbo: false,
  // },

  // ✅ Biarkan Next tahu bahwa Prisma perlu dijalankan di Node.js
  serverExternalPackages: ["@prisma/client"],

  // ✅ (Opsional tapi direkomendasikan)
  experimental: {
    esmExternals: "loose", // biar kompatibel dengan ESM Prisma
  },
};

export default config;
