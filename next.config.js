// @ts-nocheck
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  
  // Package ini harus diexternalisasi agar Prisma dapat dijalankan di lingkungan Serverless (Route Handlers)
  serverExternalPackages: ["@prisma/client"],

  // ⚠️ Experimental flags umumnya dihindari kecuali diperlukan.
  //   'esmExternals: "loose"' dan 'optimizeCss: false' mungkin tidak lagi diperlukan
  //   atau dapat menyebabkan perilaku yang tidak terduga di versi Next.js terbaru.
  //   Patch di bawah ini (yang menggunakan webpack) juga sudah usang.
  //   Saya akan hapus bagian experimental dan webpack kecuali Anda masih mengalami masalah CSS/warna.
  /*
  experimental: {
    esmExternals: "loose",
    optimizeCss: false, // 🩹 Matikan optimasi LightningCSS agar tidak parse oklch/oklab
  },
  */
  
  // 🗑️ Menghapus konfigurasi webpack lama yang digunakan sebagai patch.
  // webpack(config) {
  //   config.module.rules.forEach((rule) => {
  //     // ... (logic patch yang dihapus)
  //   });
  //   return config;
  // },
  

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  
  // ✅ Menambahkan base path jika proyek di-deploy di sub-folder
  // basePath: "/gkikarawaci", 
};

export default config;