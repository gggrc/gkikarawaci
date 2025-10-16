import { useEffect, useState } from "react";

interface RequestDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface PendingUser {
  clerkId: string;
  nama: string;
  email: string;
}

export default function RequestDrawer({ open, onClose }: RequestDrawerProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/users?status=pending")
        .then((res) => res.json())
        .then((data) => {
          setPendingUsers(Array.isArray(data) ? data : []);
        })
        .catch((err) => console.error("Error fetching pending users:", err));
    }
  }, [open]);

  const handleAction = async (clerkId: string, action: "accepted" | "rejected") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${clerkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      if (!res.ok) {
        console.error("Failed to update user:", await res.text());
        alert("Gagal memperbarui status user!");
        setLoading(false);
        return;
      }

      // Hapus user dari daftar pending
      setPendingUsers((prev) => prev.filter((u) => u.clerkId !== clerkId));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 bg-white shadow-lg transform transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 flex justify-between items-center border-b">
        <h2 className="text-lg font-bold">Pending Requests</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="p-4 space-y-3">
        {pendingUsers.length === 0 && <p>No pending users.</p>}

        {pendingUsers.map((u) => (
          <div key={u.clerkId} className="border p-3 rounded space-y-2">
            <div>
              <p className="font-semibold">{u.nama}</p>
              <p className="text-sm text-gray-600">{u.email}</p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                disabled={loading}
                onClick={() => handleAction(u.clerkId, "accepted")}
                className="bg-green-500 text-white px-2 py-1 rounded disabled:opacity-50"
              >
                Accept
              </button>
              <button
                disabled={loading}
                onClick={() => handleAction(u.clerkId, "rejected")}
                className="bg-red-500 text-white px-2 py-1 rounded disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
