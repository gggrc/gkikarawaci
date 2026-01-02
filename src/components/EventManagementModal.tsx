// src/components/EventManagementModal.tsx
import { X } from 'lucide-react';

// --- Tipe Data ---
export type EventModalType =
  | "add-single"
  | "add-periodical"
  | "edit-single"
  | "edit-periodical-confirm"
  | "flow-select";

export interface EventModalData {
  type: EventModalType;
  dateKey: string | null;
  oldName: string | null;
  newName: string;
  periodicalDayOfWeek: number | "Per Tanggal" | null;
  periodicalPeriod: string;
}

interface EventManagementModalProps {
  data: Partial<EventModalData>;
  onUpdateData: (newData: Partial<EventModalData>) => void;
  onClose: () => void;
  onAction: (payload: {
    type: "single" | "weekly" | "monthly";
    title: string;
    startDateKey: string;
    repeatDay?: number;
    endDate?: string | null;
  }) => void;
}

// --- Utility Constants ---
const MONTHLY_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: `${i + 1}m`,
  label: `${i + 1} Bulan`,
}));

const PERIOD_OPTIONS = [
  ...MONTHLY_OPTIONS,
  { value: "1y", label: "1 Tahun" },
  { value: "10y", label: "Selamanya (10 Tahun Simulasi)" },
];

export default function EventManagementModal({
  data,
  onUpdateData,
  onClose,
  onAction,
}: EventManagementModalProps) {
  const {
    type = "add-single",
    dateKey = null,
    oldName = null,
    newName = "",
    periodicalDayOfWeek = dateKey ? new Date(dateKey).getDay() : null,
    periodicalPeriod = "2m",
  } = data;

  const isEdit = type === "edit-single";
  const isAdd = type === "add-single" || type === "add-periodical";
  const isPeriodicalAdd = type === "add-periodical";
  const isPeriodicalConfirm = type === "edit-periodical-confirm";
  const isDeletion = isPeriodicalConfirm && newName === "";

  const dateDisplay = dateKey
    ? new Date(dateKey).toLocaleDateString("id-ID")
    : "N/A";

  const dayOptions = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
    "Per Tanggal",
  ];

  // --- Utility: Hitung End Date dari suatu period ("2m", "1y", dll.) ---
  function calculateEndDate(start: string, period: string): Date | null {
    const date = new Date(start);

    if (period.endsWith("m")) {
      const months = parseInt(period.replace("m", ""));
      date.setMonth(date.getMonth() + months);
      return date;
    }

    if (period.endsWith("y")) {
      const years = parseInt(period.replace("y", ""));
      date.setFullYear(date.getFullYear() + years);
      return date;
    }

    return null;
  }

  let title = "";
  let actionButtonText = "";
  let content;

  // ================= ADD / EDIT CONTENT =================

  if (isEdit) {
    title = `Edit Event: ${oldName}`;
    actionButtonText = "Simpan Perubahan";

    content = (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Tanggal: <span className="font-semibold">{dateDisplay}</span>
        </p>

        <input
          type="text"
          value={newName}
          onChange={(e) => onUpdateData({ newName: e.target.value })}
          className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
          placeholder="Nama Event Baru"
          autoFocus
        />
      </div>
    );
  } else if (isAdd) {
    title = isPeriodicalAdd ? "Tambah Event Berkala" : "Tambah Event Satuan";
    actionButtonText = isPeriodicalAdd
      ? "Tambah Event Berkala"
      : "Tambah Event Satuan";

    content = (
      <div className="space-y-4">
        {/* MODE SWITCH */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() =>
              onUpdateData({
                type: "add-single",
                periodicalDayOfWeek: null,
                periodicalPeriod: "2m",
              })
            }
            className={`px-4 py-2 text-sm rounded-lg font-semibold ${
              !isPeriodicalAdd
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Mode Satuan
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateData({
                type: "add-periodical",
                periodicalDayOfWeek: dateKey
                  ? new Date(dateKey).getDay()
                  : null,
              })
            }
            className={`px-4 py-2 text-sm rounded-lg font-semibold ${
              isPeriodicalAdd
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Mode Berkala
          </button>
        </div>

        <p className="text-sm text-gray-500 bg-indigo-50 p-2 rounded">
          Tanggal: <span className="font-semibold">{dateDisplay}</span>
        </p>

        <input
          type="text"
          value={newName}
          onChange={(e) => onUpdateData({ newName: e.target.value })}
          className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
          placeholder="Nama Event (Contoh: Kebaktian I : 07:00)"
          autoFocus
        />

        {isPeriodicalAdd && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Hari Perulangan
              </label>

              <select
                value={periodicalDayOfWeek ?? ""}
                onChange={(e) =>
                  onUpdateData({
                    periodicalDayOfWeek:
                      e.target.value === "Per Tanggal"
                        ? "Per Tanggal"
                        : Number(e.target.value),
                  })
                }
                className="w-full border-2 rounded-lg px-3 py-2"
              >
                {dayOptions.map((day, i) => (
                  <option
                    key={day}
                    value={day === "Per Tanggal" ? "Per Tanggal" : i}
                  >
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Periode Hingga
              </label>

              <select
                value={periodicalPeriod}
                onChange={(e) =>
                  onUpdateData({ periodicalPeriod: e.target.value })
                }
                className="w-full border-2 rounded-lg px-3 py-2"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isActionDisabled = isPeriodicalConfirm
    ? !newName && !isDeletion
    : isAdd && !newName.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-indigo-600">{title}</h3>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">{content}</div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isActionDisabled}
            onClick={() => {
              const endDate = calculateEndDate(dateKey!, periodicalPeriod);

              // SINGLE MODE
              if (!isPeriodicalAdd) {
                onAction({
                  type: "single",
                  title: newName,
                  startDateKey: dateKey!,
                  endDate: null,
                });
                return;
              }

              // MONTHLY (PER TANGGAL)
              if (periodicalDayOfWeek === "Per Tanggal") {
                onAction({
                  type: "monthly",
                  title: newName,
                  startDateKey: dateKey!,
                  endDate: endDate?.toISOString() ?? null,
                });
                return;
              }

              // WEEKLY
              onAction({
                type: "weekly",
                title: newName,
                startDateKey: dateKey!,
                repeatDay: Number(periodicalDayOfWeek), // ok
                day_of_week: Number(periodicalDayOfWeek),
                endDate: endDate?.toISOString() ?? null,
              });
            }}
            className={`px-6 py-2 ${
              isActionDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : isPeriodicalConfirm && isDeletion
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white rounded-lg transition`}
          >
            {actionButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
