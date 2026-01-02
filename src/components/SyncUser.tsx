import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export function SyncUser() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    // Gunakan localStorage untuk mencegah double-sync di halaman yang berbeda
    const lastSync = localStorage.getItem(`sync_${user.id}`);
    const now = Date.now();

    // Hanya sync jika belum pernah sync atau sudah lewat 1 jam
    if (!lastSync || now - parseInt(lastSync) > 3600000) {
      void fetch("/api/syncUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          email: user.primaryEmailAddress?.emailAddress,
        }),
      }).then(() => {
        localStorage.setItem(`sync_${user.id}`, now.toString());
      });
    }
  }, [user]);

  return null;
}