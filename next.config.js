// @ts-nocheck
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  serverExternalPackages: ["@prisma/client"],

  experimental: {
    esmExternals: "loose",
    optimizeCss: false, // 🩹 Matikan optimasi LightningCSS agar tidak parse oklch/oklab
  },

  webpack(config) {
    // 🩹 Patch tambahan: cegah lightningcss parse warna oklch/oklab
    config.module.rules.forEach((rule) => {
      if (Array.isArray(rule.use)) {
        rule.use.forEach((u) => {
          if (
            u?.loader?.includes("postcss-loader") ||
            u?.loader?.includes("lightningcss")
          ) {
            u.options = {
              ...u.options,
              targets: {
                browsers: ["defaults"], // fallback ke warna RGB
              },
            };
          }
        });
      } else if (rule.use && typeof rule.use === "object") {
        const u = rule.use;
        if (
          u?.loader?.includes("postcss-loader") ||
          u?.loader?.includes("lightningcss")
        ) {
          u.options = {
            ...u.options,
            targets: {
              browsers: ["defaults"],
            },
          };
        }
      }
    });
    return config;
  },


  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default config;
