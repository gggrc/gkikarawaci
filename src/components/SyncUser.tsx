import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export function SyncUser() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    // Tunggu sampai Clerk selesai loading dan pastikan user sudah login
    if (!isLoaded || !isSignedIn || !user) return;

    const performSync = async () => {
      try {
        const lastSync = localStorage.getItem(`sync_${user.id}`);
        const now = Date.now();

        // Sync jika belum pernah atau sudah lebih dari 1 jam
        if (!lastSync || now - parseInt(lastSync) > 3600000) {
          console.log("🔄 Melakukan sinkronisasi user ke Supabase...");
          
          const response = await fetch("/api/syncUser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: user.id,
              name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User GKI",
              email: user.primaryEmailAddress?.emailAddress,
            }),
          });

          if (response.ok) {
            console.log("✅ Sinkronisasi berhasil");
            localStorage.setItem(`sync_${user.id}`, now.toString());
          } else {
            console.error("❌ Gagal sinkronisasi:", await response.text());
          }
        }
      } catch (error) {
        console.error("❌ Error saat fetch syncUser:", error);
      }
    };

    void performSync();
  }, [isLoaded, isSignedIn, user]);

  return null;
}