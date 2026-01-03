import { ClerkProvider } from "@clerk/nextjs";
import type { AppProps } from "next/app";
import { SyncUser } from "@/components/SyncUser"; // Import komponen sync
import "@/styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <SyncUser />
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;