// src/components/SyncUser.tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type SyncUserProps = {
  onSynced?: () => void;
};

export default function SyncUser({ onSynced }: SyncUserProps) {
  const { user } = useUser();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!user || synced) return;

    fetch("/api/syncUser", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        console.log("User synced:", data);
        setSynced(true);
        onSynced?.();
      })
      .catch(err => console.error("SyncUser error:", err));
  }, [user, synced, onSynced]);

  return null;
}
