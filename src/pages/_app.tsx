import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { api } from "~/utils/api";
import { ClerkProvider } from '@clerk/nextjs';

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={geist.className}>
      <ClerkProvider {...pageProps}>
        <Component {...pageProps} />
      </ClerkProvider>
    </div>
  );
};

export default api.withTRPC(MyApp);
