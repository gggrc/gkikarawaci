import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { api } from "~/utils/api";
import { ClerkProvider, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

function SyncUser() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    const syncUser = async () => {
      try {
        await fetch("/api/syncUser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: user.id,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
            email: user.primaryEmailAddress?.emailAddress,
          }),
        });
        console.log("✅ Synced user globally:", user.id);
      } catch (err) {
        console.error("❌ Failed to sync user:", err);
      }
    };

    void syncUser();
  }, [user]);

  return null;
}

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={geist.className}>
      <ClerkProvider {...pageProps}>
        {/* 👇 Syncs the user globally on login */}
        <SyncUser />
        <Component {...pageProps} />
      </ClerkProvider>
      
    </div>
  );
};

export default api.withTRPC(MyApp);
