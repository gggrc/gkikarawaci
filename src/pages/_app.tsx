import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { api } from "~/utils/api";
import { ClerkProvider } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: 'swap', // Optimasi font display
});

// Lazy Load SyncUser agar tidak menambah beban bundle awal
const LazySyncUser = dynamic(() => import("~/components/SyncUser").then(mod => mod.SyncUser), {
  ssr: false,
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={geist.className}>
      <ClerkProvider {...pageProps}>
        {/* Hanya dipanggil di client-side */}
        <LazySyncUser />
        {/* Next.js secara otomatis melakukan code-splitting pada Component */}
        <Component {...pageProps} />
      </ClerkProvider>
    </div>
  );
};

export default api.withTRPC(MyApp);