// src/pages/statistic.tsx

import { useEffect, useState, useMemo, useRef } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Menu,
} from "lucide-react";
import Sidebar from "~/components/Sidebar";
import { useRouter } from "next/router";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import "jspdf-autotable"; // ⬅️ ini HARUS langsung setelah jsPDF
// Import tipe data dari API untuk konsistensi
import {
  type JemaatWithAttendanceInfo,
  type JemaatClient,
  type StatusKehadiran,
} from "~/app/api/jemaat/route";

type RechartsEvent = unknown;

interface RechartsActivePayload {
  payload?: { fullSessionName?: string };
}

interface RechartsEventSafe {
  activePayload?: RechartsActivePayload[];
}

interface YearlyChartHandlerState {
  activeLabel?: string | number;
}

// 🩹 Patch global untuk menghindari error oklch di runtime
if (
  typeof CSS !== "undefined" &&
  CSS.supports &&
  !CSS.supports("color", "oklch(50% 0.2 200)")
) {
  console.warn(
    "⚠️ Browser tidak mendukung OKLCH, warna akan dikonversi otomatis.",
  );
}

// --- Tipe Data (Disesuaikan dengan API Response) ---

// Data Jemaat Granular (Per Record Kehadiran - JemaatRow)
interface JemaatRow extends JemaatWithAttendanceInfo {
  id: string; // id_jemaat-tanggal (di-mock), must be string to match parent interface
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: StatusKehadiran;
  tanggalLahir: string;
  umur: string;
  keluarga: string;
  email: string;
  telepon: string;
  kehadiranSesi: string;
  dokumen: string;
  tanggalKehadiran: string; // Format: YYYY-MM-DD
}

// Data Jemaat Unik (Overall/Unique Jemaat - JemaatClient)
interface UniqueJemaat extends JemaatClient {
  id: string;
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: StatusKehadiran;
  tanggalLahir: string;
  umur: string;
  keluarga: string;
  email: string;
  telepon: string;
  kehadiranSesi: string; // Mocked session (dari API)
}

// Tipe response dari /api/jemaat
interface JemaatAPIResponse {
  jemaatData: UniqueJemaat[]; // List Jemaat Unik
  attendanceDates: string[]; // List Tanggal Hadir
  fullAttendanceRecords: JemaatRow[]; // List Semua Record Kehadiran
}

// --- Konstanta Kalender ---
const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();
const todayStart = new Date(today).setHours(0, 0, 0, 0);

const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (month: number, year: number) =>
  new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (month: number, year: number) =>
  new Date(year, month, 1).getDay();

// Warna untuk chart
const COLORS = [
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#4F46E5",
  "#8B5CF6",
  "#EC4899",
  "#3B82F6",
  "#A855F7",
];

// --- Logika Statistik ---

/**
 * MENGHITUNG STATISTIK KESELURUHAN DARI DATA JEMAAT UNIK (overallJemaatList)
 * @param overallJemaatList
 */
// Removed: calculateOverallStats function - use uniqueJemaatList directly for overall statistics if needed

/**
 * MENGHITUNG STATISTIK KEHADIRAN HARIAN BERDASARKAN RECORD KEHADIRAN (fullAttendanceRecords)
 * Potensi Hadir dihitung berdasarkan jumlah jemaat unik di seluruh database
 * yang SESInya cocok dengan hari yang bersangkutan.
 * @param fullAttendanceRecords
 * @param uniqueJemaatList // Diperlukan untuk menghitung POTENSI
 * @param selectedDate
 * @returns
 */
const calculateDateStats = (
  fullAttendanceRecords: JemaatRow[],
  uniqueJemaatList: UniqueJemaat[],
  selectedDate: string,
) => {
  // Hanya filter records yang tercatat hadir pada tanggal yang dipilih
  const recordsHadirDiTanggalIni = fullAttendanceRecords.filter(
    (r) => r.tanggalKehadiran === selectedDate,
  );

  // 1. Tentukan sesi yang *seharusnya* ada di tanggal ini (untuk menghitung potensi)
  const dateObj = new Date(selectedDate);
  const dayOfWeek = dateObj.getDay(); // 0 = Minggu

  const availableSessions = new Set<string>();
  if (dayOfWeek === 0) {
    // Minggu
    [
      "Kebaktian I : 07:00",
      "Kebaktian II : 10:00",
      "Kebaktian III : 17:00",
      "Ibadah Anak : Minggu, 10:00",
      "Ibadah Remaja : Minggu, 10:00",
      "Ibadah Pemuda : Minggu, 10:00",
    ].forEach((s) => availableSessions.add(s));
  } else if (dayOfWeek === 6) {
    // Sabtu
    ["Ibadah Dewasa : Sabtu, 17:00", "Ibadah Lansia : Sabtu, 10:00"].forEach(
      (s) => availableSessions.add(s),
    );
  }

  // Potensi adalah jumlah jemaat *unik* dari seluruh database
  // yang SESINYA (kehadiranSesi) cocok dengan hari ini
  let totalPotentialAttendees = new Set(
    uniqueJemaatList
      .filter((j) => availableSessions.has(j.kehadiranSesi))
      .map((j) => j.id),
  ).size;

  const totalKehadiranSemuaSesi = recordsHadirDiTanggalIni.length;

  // Total jemaat *unik* yang hadir di tanggal ini
  const uniqueAttendees = new Set(
    recordsHadirDiTanggalIni.map((r) => r.id.toString().split("-")[0]),
  );

  // Catat record kehadiran berdasarkan sesi
  const kehadiranBySesi: Record<string, number> = {};
  const statusKehadiranBySesi: Record<
    string,
    Record<StatusKehadiran, number>
  > = {};

  recordsHadirDiTanggalIni.forEach((record) => {
    const sesi = record.kehadiranSesi;
    const status = record.statusKehadiran;

    kehadiranBySesi[sesi] = (kehadiranBySesi[sesi] ?? 0) + 1;

    // Catat status jemaat yang hadir
    statusKehadiranBySesi[sesi] ??= {
      Aktif: 0,
      "Jarang Hadir": 0,
      "Tidak Aktif": 0,
    };
    statusKehadiranBySesi[sesi][status] =
      (statusKehadiranBySesi[sesi][status] || 0) + 1;
  });

  // Jika totalPotentialAttendees adalah 0 (misalnya, semua jemaat unik memiliki sesi yang tidak match hari ini),
  // gunakan jumlah jemaat unik yang hadir sebagai minimal potensi
  if (totalPotentialAttendees < uniqueAttendees.size) {
    totalPotentialAttendees = uniqueAttendees.size;
  }

  // Presentase dihitung terhadap POTENSI
  const totalHadirUnik = uniqueAttendees.size;
  const presentaseKehadiran =
    totalPotentialAttendees > 0
      ? `${((totalHadirUnik / totalPotentialAttendees) * 100).toFixed(1)}%`
      : "0%";

  return {
    totalHadir: totalHadirUnik,
    totalTidakHadir: totalPotentialAttendees - totalHadirUnik,
    presentaseKehadiran,
    kehadiranBySesi,
    statusKehadiranBySesi,
    totalKehadiranSemuaSesi,
    totalPotentialAttendees,
  };
};

/**
 * FUNGSI REAL: Menghitung tren kehadiran bulanan/tahunan (MENGGANTIKAN MOCK)
 * Menghitung status berdasarkan *status saat ini* dari jemaat yang hadir di bulan tersebut.
 */
const calculateMonthlyTrends = (
  fullAttendanceRecords: JemaatRow[],
  selectedYear: number,
  overallJemaatList: UniqueJemaat[],
) => {
  const monthlyStats: Record<
    string,
    {
      bulan: string;
      aktif: number;
      jarangHadirlah: number;
      tidakAktif: number;
      total: number;
    }
  > = {};
  const today = new Date();
  const currentMonthIndex = today.getMonth();
  const currentYear = today.getFullYear();

  // 1. Kelompokkan records berdasarkan bulan (YYYY-MM)
  const recordsByMonth = fullAttendanceRecords.reduce(
    (acc, record) => {
      const monthKey = record.tanggalKehadiran.substring(0, 7);
      acc[monthKey] ??= [];
      acc[monthKey].push(record);
      return acc;
    },
    {} as Record<string, JemaatRow[]>,
  );

  Object.entries(recordsByMonth).forEach(([monthKey, records]) => {
    const year = parseInt(monthKey.substring(0, 4));
    const monthIndex = parseInt(monthKey.substring(5, 7)) - 1;

    if (year !== selectedYear) return;

    // 2. HITUNG STATUS DARI SEMUA RECORD (Kumulatif Record)
    // Ini akan membuat: Total = Aktif + Jarang Hadir + Tidak Aktif
    const distribution = records.reduce(
      (acc, record) => {
        const status = record.statusKehadiran;
        // Gunakan status langsung dari record untuk akurasi per sesi
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { Aktif: 0, "Jarang Hadir": 0, "Tidak Aktif": 0 } as Record<
        StatusKehadiran,
        number
      >,
    );

    const monthName = monthNames[monthIndex]?.substring(0, 3) ?? "";
    monthlyStats[monthName] = {
      bulan: monthName,
      aktif: distribution.Aktif,
      jarangHadirlah: distribution["Jarang Hadir"],
      tidakAktif: distribution["Tidak Aktif"],
      total: records.length, // Total adalah jumlah semua record status
    };
  });

  const result = monthNames
    .map((name, index) => {
      const shortName = name.substring(0, 3);
      const stat = monthlyStats[shortName] ?? {
        aktif: 0,
        jarangHadirlah: 0,
        tidakAktif: 0,
        total: 0,
      };
      if (selectedYear === currentYear && index > currentMonthIndex)
        return null;
      return { ...stat, bulan: shortName };
    })
    .filter((s) => s !== null);

  return result as Array<{
    bulan: string;
    aktif: number;
    jarangHadirlah: number;
    tidakAktif: number;
    total: number;
  }>;
};

const calculateDailyTrends = (
  fullAttendanceRecords: JemaatRow[],
  selectedMonth: number,
  selectedYear: number,
) => {
  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthIndex = today.getMonth();
  const currentYear = today.getFullYear();

  let maxDay = daysInMonth;
  if (selectedYear === currentYear && selectedMonth === currentMonthIndex) {
    maxDay = currentDay;
  }

  const data: Array<{
    hari: number;
    aktif: number | null;
    jarangHadirlah: number | null;
    tidakAktif: number | null;
  }> = [];

  const recordsByDay = fullAttendanceRecords.reduce(
    (acc, record) => {
      const key = record.tanggalKehadiran ?? "";
      if (!key) return acc;
      acc[key] ??= [];
      acc[key].push(record);
      return acc;
    },
    {} as Record<string, JemaatRow[]>,
  );

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (day > maxDay) {
      data.push({
        hari: day,
        aktif: null,
        jarangHadirlah: null,
        tidakAktif: null,
      });
      continue;
    }

    const recordsForDay = recordsByDay[dateKey];

    if (recordsForDay && recordsForDay.length > 0) {
      // Hitung distribusi status berdasarkan SETIAP record (bukan orang unik)
      const counts = recordsForDay.reduce(
        (acc, record) => {
          const status: StatusKehadiran =
            record.statusKehadiran ?? "Tidak Aktif";
          acc[status] = (acc[status] ?? 0) + 1;
          return acc;
        },
        { Aktif: 0, "Jarang Hadir": 0, "Tidak Aktif": 0 } as Record<
          StatusKehadiran,
          number
        >,
      );

      data.push({
        hari: day,
        aktif: counts.Aktif,
        jarangHadirlah: counts["Jarang Hadir"],
        tidakAktif: counts["Tidak Aktif"],
      });
    } else {
      data.push({ hari: day, aktif: 0, jarangHadirlah: 0, tidakAktif: 0 });
    }
  }
  return data;
};

// Fungsi untuk mendapatkan nama sesi pendek dari nama sesi lengkap
const getShortSessionName = (session: string) => {
  return session
    .replace("Kebaktian I", "K. I")
    .replace("Kebaktian II", "K. II")
    .replace("Kebaktian III", "K. III")
    .replace("Ibadah Anak", "I. Anak")
    .replace("Ibadah Remaja", "I. Remaja")
    .replace("Ibadah Pemuda", "I. Pemuda")
    .replace("Ibadah Lansia", "I. Lansia")
    .replace("Ibadah Dewasa", "I. Dewasa")
    .replace(/\s*:.*$/, "")
    .replace(/ (Minggu|Sabtu)/, "")
    .trim();
};

// Fungsi untuk mendapatkan nama sesi yang bersih (hanya jenis ibadah/kebaktian)
const getCleanSessionName = (session: string) => {
  return session
    .replace(/ \:.*$/, "") // Hapus waktu
    .replace(/ ,.*$/, "") // Hapus hari (jika ada koma)
    .replace(/ (Minggu|Sabtu)/, "") // Hapus hari (jika tidak ada koma)
    .trim();
};

import type { LegendPayload } from "recharts/types/component/DefaultLegendContent";

// Perbaikan TOTAL tanpa any & tanpa unsafe
const renderLegend = (props: {
  payload?: readonly LegendPayload[];
}): React.ReactElement | null => {
  const payload = props.payload ?? [];
  if (payload.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        fontSize: "12px",
        lineHeight: "1.2",
      }}
    >
      {payload.map((entry, index) => (
        <div
          key={`item-${index}`}
          style={{
            color: entry.color!,
            margin: "0 8px 4px 8px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              backgroundColor: entry.color!,
              borderRadius: "50%",
              marginRight: 6,
            }}
          />
          {String(entry.value)}
        </div>
      ))}
    </div>
  );
};

// --- Komponen Chart (Dibiarkan sama) ---

interface SessionLineChartProps {
  data: Array<{
    session: string;
    fullSessionName: string;
    Aktif: number;
    "Jarang Hadir": number;
    "Tidak Aktif": number;
  }>;
  hoveredSession: string | null;
  setHoveredSession: (session: string | null) => void;
  selectedDatesKeys: string[];
}

const SessionLineChart = ({
  data,
  setHoveredSession,
  selectedDatesKeys,
}: SessionLineChartProps) => {
  const router = useRouter();

  // Handler untuk mengarahkan ke database dengan filter Tanggal + Sesi
  const handleChartClick = (
    state: {
      activePayload?: { payload: { fullSessionName: string } }[];
    } | null,
  ) => {
    if ((state?.activePayload ?? []).length > 0) {
      const sessionName = state?.activePayload?.[0]?.payload?.fullSessionName;
      if (!sessionName) return;

      // Navigasi dengan parameter multi-tanggal dan filter event
      const datesParam = selectedDatesKeys.join(",");
      void router.push(
        `/database?dates=${datesParam}&event=${encodeURIComponent(sessionName)}`,
      );
    }
  };

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 border-b pb-2 text-lg font-bold text-gray-800">
        Tren Status Kehadiran per Sesi Kebaktian (Akumulatif)
      </h3>

      <p className="mb-4 text-sm text-gray-500">
        <span className="font-semibold text-indigo-600">
          Klik titik pada grafik untuk melihat detail tabel di Database!
        </span>
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          onClick={(event: RechartsEvent) => {
            const e = event as RechartsEventSafe;

            const sessionName = e?.activePayload?.[0]?.payload?.fullSessionName;
            if (!sessionName) return;

            handleChartClick({
              activePayload: [{ payload: { fullSessionName: sessionName } }],
            });
          }}
          onMouseEnter={(event: RechartsEvent) => {
            const e = event as RechartsEventSafe;

            const sessionName = e?.activePayload?.[0]?.payload?.fullSessionName;
            if (sessionName) setHoveredSession(sessionName);
          }}
          onMouseLeave={() => setHoveredSession(null)}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="session" />
          <YAxis />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="Aktif"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
          <Line
            type="monotone"
            dataKey="Jarang Hadir"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
          <Line
            type="monotone"
            dataKey="Tidak Aktif"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Komponen Line Chart Status Kehadiran Per Sesi untuk Rincian Tanggal
interface SingleDateStatusData {
  session: string;
  fullSessionName: string;
  Aktif: number;
  "Jarang Hadir": number;
  "Tidak Aktif": number;
}

const SingleDateStatusLineChart = ({
  data,
}: {
  data: SingleDateStatusData[];
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-inner">
      <h5 className="mb-4 border-b pb-2 text-lg font-bold text-gray-800">
        Distribusi Status Jemaat yang Hadir Per Sesi
      </h5>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="session" angle={-15} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="Aktif"
            stroke="#10B981"
            strokeWidth={2}
            name="Aktif"
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
          <Line
            type="monotone"
            dataKey="Jarang Hadir"
            stroke="#F59E0B"
            strokeWidth={2}
            name="Jarang Hadir"
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
          <Line
            type="monotone"
            dataKey="Tidak Aktif"
            stroke="#EF4444"
            strokeWidth={2}
            name="Tidak Aktif"
            dot={{ r: 4 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Komponen Line Chart untuk Tampilan Bulanan (Timeseries Harian)
interface MonthLineChartProps {
  data: Array<{
    hari: number;
    aktif: number | null;
    jarangHadirlah: number | null;
    tidakAktif: number | null;
  }>;
  month: number;
  year: number;
}

const MonthLineChart = ({ data, month, year }: MonthLineChartProps) => {
  const router = useRouter();
  const today = new Date();
  const todayKey = today.getDate();
  const currentMonthKey = today.getMonth();
  const currentYearKey = today.getFullYear();

  const handleDailyChartClick = (state: { activeLabel?: number } | null) => {
    if (
      state &&
      typeof state === "object" &&
      "activeLabel" in state &&
      typeof state.activeLabel === "number"
    ) {
      const day = state.activeLabel;

      // Format tanggal yang diklik: YYYY-MM-DD
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // NAVIGASI DENGAN PARAMETER YANG JELAS: dates=YYYY-MM-DD
      void router.push(`/database?dates=${dateKey}`);
    }
  };

  // Tentukan hari terakhir yang datanya valid (tidak boleh melewati hari ini)
  let maxDay = getDaysInMonth(month, year);
  if (year === currentYearKey && month === currentMonthKey) {
    maxDay = todayKey;
  }

  // Filter data yang null (future dates)
  const validData = data.filter(
    (d: {
      hari: number;
      aktif: number | null;
      jarangHadirlah: number | null;
      tidakAktif: number | null;
    }) => d.hari <= maxDay,
  );

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
      <h3 className="mb-4 border-b pb-2 text-xl font-bold text-gray-800">
        Tren Status Kehadiran Per Tanggal
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        <span className="font-semibold text-indigo-600">
          Klik titik pada grafik untuk melihat detail tabel di hari tersebut!
        </span>
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={validData} // Gunakan data yang sudah difilter
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          onClick={(state) => {
            if (state?.activeLabel) {
              handleDailyChartClick({
                activeLabel:
                  typeof state.activeLabel === "string"
                    ? parseInt(state.activeLabel, 10)
                    : state.activeLabel,
              });
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="hari"
            allowDecimals={false}
            domain={[1, maxDay]}
            ticks={Array.from(
              { length: Math.min(maxDay, 15) },
              (_, i) => i * (Math.floor(maxDay / 15) || 1) + 1,
            ).filter((d) => d <= maxDay)}
          />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value: unknown, name: string) => {
              if (value === null || value === undefined)
                return ["Tidak Ada Data", name];
              if (typeof value === "object")
                return [JSON.stringify(value), name];
              if (Array.isArray(value)) return [value.join(", "), name];
              if (typeof value === "number") return [String(value), name];
              if (typeof value === "string") return [value, name];
              return ["", name];
            }}
            labelFormatter={(label: number) =>
              `Tanggal ${label} ${monthNames[month]}`
            }
          />
          <Legend />
          {/* connectNulls=true untuk garis yang menyambung */}
          <Line
            type="monotone"
            dataKey="aktif"
            stroke="#10B981"
            strokeWidth={2}
            name="Aktif"
            connectNulls={true}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="jarangHadirlah"
            stroke="#F59E0B"
            strokeWidth={2}
            name="Jarang Hadir"
            connectNulls={true}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="tidakAktif"
            stroke="#EF4444"
            strokeWidth={2}
            name="Tidak Aktif"
            connectNulls={true}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Komponen Pie Chart (DIPERBAIKI TATA LETAK LEGENDA)
interface PieChartCardProps {
  title: string;
  data: Record<string, number>;
  description: string;
  hoveredSession: string | null;
  setHoveredSession: (session: string | null) => void;
}

const PieChartCard = ({
  title,
  data,
  description,
  hoveredSession,
  setHoveredSession,
}: PieChartCardProps) => {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    fullSessionName: name,
  }));

  const handleMouseEnter = (entry: {
    name: string;
    value: number;
    fullSessionName: string;
  }) => {
    setHoveredSession(entry.fullSessionName);
  };

  const handleMouseLeave = () => {
    setHoveredSession(null);
  };

  return (
    <div className="h-full rounded-xl bg-white p-6 shadow-lg">
      <h3 className="mb-3 border-b pb-2 text-lg font-bold text-gray-800">
        {title}
      </h3>
      <p className="mb-4 text-sm text-gray-500">{description}</p>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            // Menonaktifkan label di slices untuk mencegah tumpang tindih
            label={false}
            outerRadius={80} // Disesuaikan sedikit lebih kecil (dari 90 ke 80)
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                // Menambahkan opasitas jika bukan sesi yang di-hover
                opacity={
                  hoveredSession === null ||
                  hoveredSession === entry.fullSessionName
                    ? 1
                    : 0.5
                }
                onMouseEnter={() => handleMouseEnter(entry)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: string) => {
              if (value === null || value === undefined)
                return ["Tidak Ada Data", name];
              if (Array.isArray(value)) return [value.join(", "), name];
              if (typeof value === "object")
                return [JSON.stringify(value), name];
              return [`${typeof value === "number" ? value : 0} orang`, name];
            }}
          />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: "0px", marginBottom: "-30px" }}
            content={renderLegend}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- Komponen Utama ---
export default function StatisticPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const res = await fetch("/api/me");
        const data = (await res.json()) as {
          role?: "admin" | "user" | null;
          isVerified?: "pending" | "accepted" | "rejected" | null;
        };

        // Jika tidak ada data atau tidak terautentikasi (opsional: Clerk handle ini, tapi bagus untuk jaga-jaga)
        if (!data.role) {
          void router.push("/login");
          return;
        }

        // User yang masih pending atau rejected tidak boleh akses
        if (data.isVerified === "pending") {
          void router.push("/unauthorized"); // ✅ PERUBAHAN: Dialihkan ke /unauthorized jika status pending
          return;
        }

        if (data.isVerified === "rejected") {
          void router.push("/rejected"); // atau ke halaman lain
          return;
        }
      } catch (err) {
        console.error("Error checking user status:", err);
        // Fallback: kirim ke halaman utama jika ada error
        void router.push("/");
      }
    };

    // Periksa status saat komponen dimuat
    void checkUserStatus();
  }, [router]);

  // FIX 1: Ganti state jemaat menjadi data kehadiran granular
  const [fullAttendanceRecords, setFullAttendanceRecords] = useState<
    JemaatRow[]
  >([]);
  // FIX 2: Tambahkan state untuk data jemaat unik (diperlukan untuk overall stats)
  const [uniqueJemaatList, setUniqueJemaatList] = useState<UniqueJemaat[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [detailYear, setDetailYear] = useState(currentYear);
  const [detailStartMonth, setDetailStartMonth] = useState(currentMonth);
  const [selectedDatesKeys, setSelectedDatesKeys] = useState<string[]>([]);

  const [year, setYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showDetailYearPicker, setShowDetailYearPicker] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(
    Math.floor(currentYear / 10) * 10,
  );

  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [actualAttendanceDates, setActualAttendanceDates] = useState<string[]>(
    [],
  );

  // Mengambil data dari /api/jemaat
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat");

        if (!res.ok) {
          const errorBody = await (res
            .json()
            .catch(() => ({})) as Promise<unknown>);
          const errorMessage =
            typeof errorBody === "object" &&
            errorBody !== null &&
            "error" in errorBody &&
            typeof (errorBody as { error?: unknown }).error === "string"
              ? (errorBody as { error?: string }).error
              : `Gagal fetch data jemaat. Status: ${res.status}`;
          throw new Error(errorMessage);
        }

        const data: unknown = await res.json();

        const apiResponse = data as JemaatAPIResponse;

        if (
          Array.isArray(apiResponse.jemaatData) &&
          apiResponse.jemaatData.length > 0
        ) {
          // FIX 3: Simpan kedua tipe data dari API response
          setUniqueJemaatList(apiResponse.jemaatData);
          setFullAttendanceRecords(apiResponse.fullAttendanceRecords);
          setActualAttendanceDates(apiResponse.attendanceDates);
        } else {
          throw new Error("Data jemaat tidak valid atau kosong");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengambil data jemaat.";
        console.error("Error fetch jemaat:", errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  // Handle query parameter untuk multiple selected dates dari URL
  useEffect(() => {
    if (!router.isReady) return;

    const { dates } = router.query;

    if (typeof dates === "string" && dates.length > 0) {
      const datesArray = dates
        .split(",")
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.exec(d));
      setSelectedDatesKeys(datesArray);

      if (datesArray.length > 0) {
        const firstIso = datesArray[0];
        if (firstIso) {
          const firstDate = new Date(firstIso);
          if (!isNaN(firstDate.getTime())) {
            setDetailYear(firstDate.getFullYear());
            setDetailStartMonth(firstDate.getMonth());

            setYear(firstDate.getFullYear());
            setStartMonth(firstDate.getMonth());
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // --- LOGIKA MULTI-DATE STATS ---
  const dateStatsMap = useMemo(() => {
    if (selectedDatesKeys.length === 0) return {};

    const stats: Record<string, ReturnType<typeof calculateDateStats>> = {};

    selectedDatesKeys.forEach((dateKey) => {
      // Hanya hitung statistik jika ada data kehadiran yang tercatat untuk tanggal ini
      if (actualAttendanceDates.includes(dateKey)) {
        // FIX 5: Kirim kedua list data untuk perhitungan potensi kehadiran
        stats[dateKey] = calculateDateStats(
          fullAttendanceRecords,
          uniqueJemaatList,
          dateKey,
        );
      }
    });

    return stats;
  }, [
    fullAttendanceRecords,
    selectedDatesKeys,
    actualAttendanceDates,
    uniqueJemaatList,
  ]);

  // Total jemaat unik yang hadir di tanggal yang dipilih
  const totalHadirUnikSelectedDates = useMemo(() => {
    return Object.values(dateStatsMap).reduce(
      (sum, stats) => sum + stats.totalHadir,
      0,
    );
  }, [dateStatsMap]);

  const combinedKehadiranBySesi = useMemo(() => {
    const combined: Record<string, number> = {};
    Object.values(dateStatsMap).forEach((stats) => {
      Object.entries(stats.kehadiranBySesi).forEach(([session, count]) => {
        combined[session] = (combined[session] ?? 0) + count;
      });
    });
    return combined;
  }, [dateStatsMap]);

  const selectedDatesDisplay = useMemo(() => {
    return selectedDatesKeys
      .map((key) =>
        new Date(key).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
        }),
      )
      .join(", ");
  }, [selectedDatesKeys]);

  const totalPotentialAttendeesCombined = useMemo(() => {
    return Object.values(dateStatsMap).reduce(
      (sum, stats) => sum + stats.totalPotentialAttendees,
      0,
    );
  }, [dateStatsMap]);

  const combinedPresentaseKehadiran =
    totalPotentialAttendeesCombined > 0
      ? // Presentase dihitung dari total jemaat unik yang hadir dibagi total potensi
        `${((totalHadirUnikSelectedDates / totalPotentialAttendeesCombined) * 100).toFixed(1)}%`
      : "0%";

  /**
   * LOGIKA BARU: Mengakumulasi status kehadiran (Aktif, Jarang Hadir, Tidak Aktif)
   * DARI SEMUA JEMAAT YANG HADIR di sesi-sesi pada tanggal yang dipilih.
   */
  const combinedStatusBySession = useMemo(() => {
    const combined: Record<string, Record<StatusKehadiran, number>> = {};

    // Akumulasi data statusKehadiranBySesi dari semua tanggal yang dipilih
    Object.values(dateStatsMap).forEach((stats) => {
      Object.entries(stats.statusKehadiranBySesi).forEach(
        ([session, statusCounts]) => {
          combined[session] ??= {
            Aktif: 0,
            "Jarang Hadir": 0,
            "Tidak Aktif": 0,
          };

          combined[session].Aktif += statusCounts.Aktif || 0;
          combined[session]["Jarang Hadir"] +=
            statusCounts["Jarang Hadir"] || 0;
          combined[session]["Tidak Aktif"] += statusCounts["Tidak Aktif"] || 0;
        },
      );
    });

    // Transformasi data untuk Recharts LineChart
    const chartData = Object.entries(combined)
      .map(([session, statuses]) => ({
        session: getShortSessionName(session),
        fullSessionName: session,
        Aktif: statuses.Aktif,
        "Jarang Hadir": statuses["Jarang Hadir"],
        "Tidak Aktif": statuses["Tidak Aktif"],
      }))
      .filter(
        (item) =>
          item.Aktif > 0 || item["Jarang Hadir"] > 0 || item["Tidak Aktif"] > 0,
      );

    return chartData;
  }, [dateStatsMap]);

  // --- END LOGIKA MULTI-DATE STATS ---

  // 🔥 SISIPKAN monthlyStatusData DI SINI
  const monthlyStatusData = useMemo(() => {
    const hadirPerBulan = fullAttendanceRecords.filter(
      (a) =>
        new Date(a.tanggalKehadiran).getMonth() === startMonth &&
        new Date(a.tanggalKehadiran).getFullYear() === year,
    );

    const active = hadirPerBulan.filter(
      (a) => a.statusKehadiran === "Aktif",
    ).length;
    const rare = hadirPerBulan.filter(
      (a) => a.statusKehadiran === "Jarang Hadir",
    ).length;
    const inactive = hadirPerBulan.filter(
      (a) => a.statusKehadiran === "Tidak Aktif",
    ).length;

    return [
      { status: "Aktif", jumlah: active },
      { status: "Jarang Hadir", jumlah: rare },
      { status: "Tidak Aktif", jumlah: inactive },
    ];
  }, [fullAttendanceRecords, startMonth, year]);

  // FIX 6: Gunakan fungsi kalkulasi nyata untuk data Tahunan
  const yearlyStats = useMemo(
    () => calculateMonthlyTrends(fullAttendanceRecords, year, uniqueJemaatList),
    [fullAttendanceRecords, year, uniqueJemaatList],
  );

  const currentMonthStats = useMemo(() => {
    const monthLabel = monthNames[startMonth] ?? "";
    const monthName = monthLabel.substring(0, 3);
    const arr = yearlyStats as Array<{
      bulan: string;
      aktif: number;
      jarangHadirlah: number;
      tidakAktif: number;
      total: number;
    }>;
    const found = arr.find((m) => m.bulan === monthName);
    return found ?? { aktif: 0, jarangHadirlah: 0, tidakAktif: 0, total: 0 };
  }, [startMonth, yearlyStats]);

  const currentYearStats = useMemo(() => {
    const stats = yearlyStats;

    return stats;
  }, [yearlyStats]);

  // NEW LOGIC: Hitung total dan rata-rata dari data Line Chart Tahunan yang sudah difilter/dipotong
  const totalAktifTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.aktif, 0);
  }, [currentYearStats]);

  const totalJarangHadirlahTahunan = useMemo(() => {
    return currentYearStats.reduce(
      (sum, month) => sum + month.jarangHadirlah,
      0,
    );
  }, [currentYearStats]);

  const totalTidakAktifTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.tidakAktif, 0);
  }, [currentYearStats]);

  const totalKehadiranTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.total, 0);
  }, [currentYearStats]);

  const rataRataKehadiranPerBulan = useMemo(() => {
    const activeMonths = currentYearStats.length;
    if (activeMonths === 0 || totalKehadiranTahunan === 0) return 0;

    // Hitung total jemaat unik yang hadir di tahun ini
    const uniqueAttendeesInYear = new Set<string>();
    fullAttendanceRecords
      .filter((r) => r.tanggalKehadiran.startsWith(year.toString()))
      .forEach((r) => {
        const jemaatId = r.id ? r.id.toString().split("-")[0] : undefined;
        if (typeof jemaatId === "string" && jemaatId.length > 0) {
          uniqueAttendeesInYear.add(jemaatId);
        }
      });

    if (uniqueAttendeesInYear.size === 0) return 0;

    // Hitung rata-rata berdasarkan jumlah jemaat unik per bulan
    return Math.round(uniqueAttendeesInYear.size / activeMonths);
  }, [currentYearStats, totalKehadiranTahunan, fullAttendanceRecords, year]);

  // FIX 7: Gunakan fungsi kalkulasi nyata untuk data Harian Bulanan
  const dailyTrendsData = useMemo(() => {
    if (fullAttendanceRecords.length === 0) return [];
    return calculateDailyTrends(fullAttendanceRecords, startMonth, year);
  }, [startMonth, year, fullAttendanceRecords]);

  // Handler untuk Kalender Detail (Sekarang multi-select)
  const handleSelectDate = (day: number, month: number) => {
    const clickedDate = new Date(detailYear, month, day);
    const key = getDayKey(clickedDate);

    setSelectedDatesKeys((prevKeys) => {
      if (prevKeys.includes(key)) {
        return prevKeys.filter((k) => k !== key);
      } else {
        return [...prevKeys, key].sort();
      }
    });
  };

  // Handlers NAVIGASI GLOBAL (Tampilan Bulanan/Tahunan)
  const handlePrevYear = () => {
    setYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    if (year < currentYear) {
      // Batasi hanya sampai tahun saat ini
      setYear((prev) => prev + 1);
    }
  };

  const handlePrevMonth = () => {
    if (startMonth === 0) {
      setStartMonth(11);
      setYear(year - 1);
    } else {
      setStartMonth((prev) => prev - 1);
    }
  };

  // LOGIKA BARU: Batasi navigasi ke depan (Next Month)
  const handleNextMonth = () => {
    const nextDate = new Date(year, startMonth + 1, 1);

    // Periksa jika bulan berikutnya lebih besar dari bulan saat ini di tahun yang sama
    if (
      nextDate.getFullYear() > currentYear ||
      (nextDate.getFullYear() === currentYear &&
        nextDate.getMonth() > currentMonth)
    ) {
      // Tidak boleh maju ke masa depan
      return;
    }

    if (startMonth === 11) {
      setStartMonth(0);
      setYear(year + 1);
    } else {
      setStartMonth((prev) => prev + 1);
    }
  };

  // Logika untuk menonaktifkan tombol Next Month
  const isNextMonthDisabled = useMemo(() => {
    // Navigasi tidak boleh melewati bulan saat ini
    return (
      year > currentYear || (year === currentYear && startMonth >= currentMonth)
    );
  }, [year, startMonth]);

  // Logika untuk menonaktifkan tombol Next Year
  const isNextYearDisabled = useMemo(() => {
    // Navigasi tidak boleh melewati tahun saat ini
    return year >= currentYear;
  }, [year]);

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setShowYearPicker(false);
  };

  const handleOpenYearPicker = () => {
    setShowYearPicker(true);
    setGridStartYear(Math.floor(year / 10) * 10);
  };

  // Handlers NAVIGASI DETAIL KALENDER
  const handleDetailPrevMonth = () => {
    if (detailStartMonth === 0) {
      setDetailStartMonth(11);
      setDetailYear(detailYear - 1);
    } else {
      setDetailStartMonth((prev) => prev - 1);
    }
  };

  const handleDetailNextMonth = () => {
    if (detailStartMonth === 11) {
      setDetailStartMonth(0);
      setDetailYear(detailYear + 1);
    } else {
      setDetailStartMonth((prev) => prev + 1);
    }
  };

  const handleDetailYearChange = (newYear: number) => {
    setDetailYear(newYear);
    setShowDetailYearPicker(false);
  };

  const handleOpenDetailYearPicker = () => {
    setShowDetailYearPicker(true);
    setGridStartYear(Math.floor(detailYear / 10) * 10); // Sync grid start year
  };

  const monthsToDisplay = useMemo(() => {
    const months = [];
    // Tentukan jumlah bulan yang akan ditampilkan: 1 untuk mobile, 3 untuk desktop
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const count = isMobile ? 1 : 3;

    // Tentukan bulan awal tampilan.
    const startMonthOffset = isMobile ? 0 : -1;

    for (let i = 0; i < count; i++) {
      const targetDate = new Date(
        detailYear,
        detailStartMonth + startMonthOffset + i,
        1,
      );
      const monthIndex = targetDate.getMonth();
      const year = targetDate.getFullYear();
      months.push({ monthIndex, year });
    }
    return months;
  }, [detailStartMonth, detailYear]);

  // Generate tahun untuk year picker
  const yearsForPicker = useMemo(() => {
    const startYear = gridStartYear;
    return Array.from({ length: 10 }, (_, i) => startYear + i);
  }, [gridStartYear]);

  // Konversi actualAttendanceDates ke Set untuk lookup yang efisien
  const actualAttendanceSet = useMemo(
    () => new Set(actualAttendanceDates),
    [actualAttendanceDates],
  );

  // Tanggal yang memiliki statistik (yaitu, ada data kehadiran aktual)
  const getDatesWithStats = (
    month: number,
    year: number,
    actualAttendanceSet: Set<string>,
  ) => {
    const dates = new Set<string>();
    const daysInMonth = getDaysInMonth(month, year);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayKey = getDayKey(date);

      // Sekarang hanya mengecek apakah 'dayKey' ada di dalam set data, 
      // tanpa peduli apakah itu hari ini, kemarin, atau esok hari.
      if (actualAttendanceSet.has(dayKey)) {
        dates.add(dayKey);
      }
    }
    return dates;
  };
  // Handler untuk LineChart Tahunan (Navigasi ke database bulan itu)
  const handleYearlyChartClick = (state: YearlyChartHandlerState | null) => {
    if (state?.activeLabel) {
      // ✅ FIX: Konversi activeLabel ke string secara eksplisit
      const monthName = String(state.activeLabel);
      const monthIndex = monthNames.findIndex(
        (name) => name.substring(0, 3) === monthName,
      );

      if (monthIndex > -1) {
        // NAVIGASI DENGAN PARAMETER YANG JELAS: date=YYYY-MM
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
        void router.push(`/database?date=${dateKey}&mode=monthly`);
      }
    }
  };

  // LOGIKA DOWNLOAD UTAMA PDF (DIUBAH UNTUK MENGATASI AUTO-TABLE ERROR)
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const statElement = document.getElementById("statistic-content");
      if (!statElement) {
        alert("Elemen konten statistik tidak ditemukan.");
        setIsDownloading(false);
        return;
      }

      // Sembunyikan sidebar sementara agar tidak ikut ke capture
      const sidebar = document.querySelector(".fixed.top-0.left-0.h-screen");
      if (sidebar) (sidebar as HTMLElement).style.display = "none";
      // Sembunyikan tombol burger menu
      const menuButton = document.getElementById("mobile-menu-button");
      if (menuButton) menuButton.style.display = "none";

      // Scroll ke atas agar posisi benar
      window.scrollTo(0, 0);

      // 🧩 Buat klon untuk memberi margin dan skala aman
      const cloned = statElement.cloneNode(true) as HTMLElement;
      cloned.style.padding = "30px";
      cloned.style.transform = "scale(0.85)";
      cloned.style.transformOrigin = "top left";
      cloned.style.backgroundColor = "#ffffff";
      cloned.style.width = "calc(100% - 60px)";
      cloned.style.maxWidth = "1200px";
      cloned.style.margin = "0 auto";

      // Hapus tombol-tombol yang tidak perlu di PDF (seperti tombol download/statistik)
      cloned.querySelectorAll("button").forEach((btn) => {
        if (
          btn.textContent?.includes("Download") ||
          btn.textContent?.includes("Statistik")
        ) {
          (btn as HTMLElement).style.display = "none";
        }
      });
      // Sembunyikan juga tombol navigasi bulan/tahun
      cloned.querySelectorAll(".rounded-full.p-3").forEach((btn) => {
        (btn as HTMLElement).style.display = "none";
      });
      // Sembunyikan juga keterangan "Klik titik pada grafik"
      cloned.querySelectorAll("p").forEach((p) => {
        if (p.textContent?.includes("Klik titik pada grafik")) {
          (p as HTMLElement).style.display = "none";
        }
      });

      document.body.appendChild(cloned);

      // 🖼️ Konversi ke gambar (JPEG lebih kecil dari PNG)
      const dataUrl = await htmlToImage.toJpeg(cloned, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 1.5, // kurangi resolusi sedikit untuk efisiensi
        quality: 0.5, // 50% kualitas → ukuran jauh lebih kecil
      });

      document.body.removeChild(cloned);
      if (sidebar) (sidebar as HTMLElement).style.display = "";
      if (menuButton) menuButton.style.display = "";

      // --- Generate PDF ---
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: "a4",
        compress: true, // aktifkan kompres internal jsPDF
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => (img.onload = resolve));

      const imgWidth = img.width;
      const imgHeight = img.height;

      // Fit otomatis agar muat di margin PDF
      const margin = 20;
      const availableWidth = pageWidth - margin * 2;
      const scale = availableWidth / imgWidth;
      const scaledHeight = imgHeight * scale;

      let yOffset = 0;
      while (yOffset < scaledHeight) {
        pdf.addImage(
          dataUrl,
          "JPEG",
          margin,
          margin - yOffset,
          availableWidth,
          scaledHeight,
        );
        yOffset += pageHeight - margin * 2; // Pindah halaman sesuai tinggi area cetak
        if (yOffset < scaledHeight) pdf.addPage();
      }
      pdf.save("Laporan-Statistik.pdf");
    } catch (error) {
      console.error("❌ Gagal membuat PDF:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    // Outer flex container
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (FIX: Removed lg:relative) */}
      <div
        className={`fixed top-0 left-0 z-40 h-screen w-64 transform bg-white shadow-2xl transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Menggunakan `isOpen` dan `onClose` untuk kontrol di Sidebar */}
        <Sidebar
          activeView="statistic"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content Wrapper (FIX: Use lg:ml-64 offset and control scrolling here) */}
      <div className="w-full overflow-y-auto lg:ml-64">
        <main className={`w-full p-4 transition-all duration-300 md:p-8`}>
          {/* Hamburger Menu for Mobile */}
          <div className="mb-4 flex justify-start lg:hidden">
            <button
              id="mobile-menu-button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-full bg-indigo-600 p-2 text-white shadow-md"
            >
              <Menu size={24} />
            </button>
          </div>

          <div id="statistic-content" ref={contentRef}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-gray-800 md:text-3xl">
                Laporan dan Statistik Jemaat
              </h1>
              <button
                onClick={handleDownload}
                disabled={
                  isLoading ||
                  (viewMode === "yearly" &&
                    selectedDatesKeys.length === 0 &&
                    currentYearStats.length === 0) ||
                  (viewMode === "monthly" &&
                    selectedDatesKeys.length === 0 &&
                    currentMonthStats.total === 0)
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-400 md:text-base"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Download Laporan (PDF)</span>
                <span className="sm:hidden">Download</span>
              </button>
            </div>

            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2
                  size={32}
                  className="mr-2 animate-spin text-indigo-600"
                />
                <p className="text-xl text-indigo-600">
                  Memuat data statistik...
                </p>
              </div>
            ) : (
              <>
                {/* Statistik Keseluruhan */}
                <section className="mb-10">
                  <h2 className="mb-4 flex items-center border-b pb-2 text-xl font-bold text-indigo-700 md:text-2xl">
                    <BarChart3 size={20} className="mr-2" /> Statistik
                    Keseluruhan Database
                  </h2>

                  {/* Toggle View Mode */}
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setViewMode("monthly")}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold shadow-md transition-all duration-200 sm:px-8 sm:text-lg ${
                        viewMode === "monthly"
                          ? "scale-105 bg-indigo-600 text-white shadow-lg"
                          : "border-2 border-gray-300 bg-white text-gray-600 hover:border-indigo-400 hover:bg-gray-50"
                      }`}
                    >
                      Tampilan Bulanan
                    </button>
                    <button
                      onClick={() => setViewMode("yearly")}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold shadow-md transition-all duration-200 sm:px-8 sm:text-lg ${
                        viewMode === "yearly"
                          ? "scale-105 bg-indigo-600 text-white shadow-lg"
                          : "border-2 border-gray-300 bg-white text-gray-600 hover:border-indigo-400 hover:bg-gray-50"
                      }`}
                    >
                      Tampilan Tahunan
                    </button>
                  </div>

                  {/* Navigasi Bulan/Tahun (Global) */}
                  <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-3 shadow-md sm:p-5">
                    {/* Navigasi Kiri (Tahun/Bulan) */}
                    {viewMode === "yearly" ? (
                      <button
                        onClick={handlePrevYear}
                        className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100 sm:p-3"
                      >
                        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    ) : (
                      <button
                        onClick={handlePrevMonth}
                        className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100 sm:p-3"
                      >
                        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    )}

                    <div className="relative">
                      {/* Tombol Tengah (Year Picker) */}
                      <button
                        onClick={handleOpenYearPicker} // Panggil picker di kedua mode
                        className="rounded-lg px-3 py-1 text-lg font-bold text-gray-800 transition hover:bg-indigo-50 hover:text-indigo-600 sm:px-6 sm:py-2 sm:text-2xl"
                      >
                        {viewMode === "monthly"
                          ? `${monthNames[startMonth]} ${year}`
                          : `Tahun ${year}`}
                      </button>

                      {/* MODAL YEAR PICKER GLOBAL */}
                      {showYearPicker && (
                        <div className="absolute top-full left-1/2 z-10 mt-2 min-w-[300px] -translate-x-1/2 transform rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:min-w-[400px]">
                          <div className="mb-4 flex items-center justify-between">
                            <button
                              onClick={() =>
                                setGridStartYear((prev) => prev - 10)
                              }
                              className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <span className="text-lg font-semibold text-gray-700">
                              {gridStartYear} - {gridStartYear + 9}
                            </span>
                            <button
                              onClick={() =>
                                setGridStartYear((prev) => prev + 10)
                              }
                              className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-3">
                            {yearsForPicker.map((y) => (
                              <button
                                key={y}
                                onClick={() => handleYearChange(y)}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition sm:text-base ${
                                  y === year
                                    ? "bg-indigo-600 text-white shadow-lg"
                                    : "border border-gray-200 text-gray-700 hover:bg-indigo-100"
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                          <div className="mt-6 flex justify-center">
                            <button
                              onClick={() => setShowYearPicker(false)}
                              className="rounded-lg border-2 border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50"
                            >
                              Tutup
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Navigasi Kanan (Tahun/Bulan) */}
                    {viewMode === "yearly" ? (
                      <button
                        onClick={handleNextYear}
                        disabled={isNextYearDisabled} // Menonaktifkan tombol jika navigasi melewati tahun ini
                        className={`rounded-full p-2 text-indigo-600 transition sm:p-3 ${
                          isNextYearDisabled
                            ? "cursor-not-allowed text-gray-400"
                            : "hover:bg-indigo-100"
                        }`}
                      >
                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    ) : (
                      <button
                        onClick={handleNextMonth}
                        disabled={isNextMonthDisabled} // Menonaktifkan tombol jika navigasi melewati bulan ini
                        className={`rounded-full p-2 text-indigo-600 transition sm:p-3 ${
                          isNextMonthDisabled
                            ? "cursor-not-allowed text-gray-400"
                            : "hover:bg-indigo-100"
                        }`}
                      >
                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    )}
                  </div>

                  {/* Tampilan Bulanan */}
                  {viewMode === "monthly" && (
                    <>
                      {/* Summary Cards DENGAN TOTAL KEHADIRAN */}
                      {/* Summary Cards DENGAN TOTAL KEHADIRAN */}
                      <div className="mb-8">
                        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                          {/* 0. Total Kehadiran Records */}
                          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 p-4 text-white shadow-xl sm:p-6">
                            <p className="mb-1 text-xs opacity-90 sm:text-sm">
                              Total Records Kehadiran
                            </p>
                            <p className="mt-1 text-3xl font-extrabold sm:text-4xl">
                              {currentMonthStats.total}
                            </p>
                            <p className="mt-1 text-xs opacity-80">
                              total presensi terkumpul
                            </p>
                          </div>

                          {/* 1. Status Aktif */}
                          <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-4 text-white shadow-xl sm:p-6">
                            <p className="mb-1 text-xs opacity-90 sm:text-sm">
                              Presensi Status Aktif
                            </p>
                            <p className="text-3xl font-extrabold sm:text-4xl">
                              {currentMonthStats.aktif}
                            </p>
                            <p className="mt-1 text-xs opacity-80">
                              akumulasi dari semua sesi
                            </p>
                          </div>

                          {/* 2. Status Jarang Hadir */}
                          <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 text-white shadow-xl sm:p-6">
                            <p className="mb-1 text-xs opacity-90 sm:text-sm">
                              Presensi Jarang Hadir
                            </p>
                            <p className="text-3xl font-extrabold sm:text-4xl">
                              {currentMonthStats.jarangHadirlah}
                            </p>
                            <p className="mt-1 text-xs opacity-80">
                              akumulasi dari semua sesi
                            </p>
                          </div>

                          {/* 3. Status Tidak Aktif */}
                          <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-4 text-white shadow-xl sm:p-6">
                            <p className="mb-1 text-xs opacity-90 sm:text-sm">
                              Presensi Tidak Aktif
                            </p>
                            <p className="text-3xl font-extrabold sm:text-4xl">
                              {currentMonthStats.tidakAktif}
                            </p>
                            <p className="mt-1 text-xs opacity-80">
                              akumulasi dari semua sesi
                            </p>
                          </div>
                        </div>

                        {/* Grafik Statistik Bulanan (DIUBAH) */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          {/* Pie Chart: Distribusi Status Kehadiran Bulanan */}
                          <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-lg">
                            <h3 className="mb-4 border-b pb-2 text-lg font-bold text-gray-800">
                              Distribusi Status Kehadiran Bulan{" "}
                              {monthNames[startMonth]}
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie
                                  data={monthlyStatusData.map((item) => ({
                                    name: item.status,
                                    value: item.jumlah,
                                  }))}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={false}
                                  outerRadius={90}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  <Cell fill="#10B981" />
                                  <Cell fill="#F59E0B" />
                                  <Cell fill="#EF4444" />
                                </Pie>
                                <Tooltip />
                                <Legend content={renderLegend} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* MonthLineChart: Tren Status Kehadiran Per Tanggal (NEW) */}
                          <MonthLineChart
                            data={dailyTrendsData}
                            month={startMonth}
                            year={year}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Tampilan Tahunan - Diagram Garis (PERBAIKAN SINKRONISASI) */}
                  {viewMode === "yearly" && (
                    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-xl sm:p-8">
                      <h3 className="mb-6 text-xl font-bold text-gray-800 md:text-2xl">
                        Statistik Kehadiran Tahunan {year}
                      </h3>

                      <ResponsiveContainer width="100%" height={450}>
                        <LineChart
                          data={currentYearStats}
                          margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                          onMouseDown={handleYearlyChartClick}
                          style={{ cursor: "pointer" }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="bulan" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="aktif"
                            stroke="#10B981"
                            strokeWidth={3}
                            name="Aktif"
                            dot={{ fill: "#10B981" }}
                            activeDot={{ r: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="jarangHadirlah"
                            stroke="#F59E0B"
                            strokeWidth={3}
                            name="Jarang Hadir"
                            dot={{ fill: "#F59E0B" }}
                            activeDot={{ r: 8 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="tidakAktif"
                            stroke="#EF4444"
                            strokeWidth={3}
                            name="Tidak Aktif"
                            dot={{ fill: "#EF4444" }}
                            activeDot={{ r: 8 }}
                          />
                          {/* PERBAIKAN: dot={false} untuk Total Kehadiran */}
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="#4F46E5"
                            strokeWidth={4}
                            name="Total Records Kehadiran"
                            dot={false} // PERBAIKAN: Menghilangkan titik
                            activeDot={false} // PERBAIKAN: Menghilangkan titik aktif
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Summary Cards Tahunan (MENJADI 5 KARTU) */}
                      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {/* Kartu 1: Total Kehadiran Tahunan */}
                        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 text-center sm:p-6">
                          <p className="mb-2 text-xs font-semibold text-indigo-700 sm:text-sm">
                            Total Records Kehadiran Tahunan
                          </p>
                          <p className="text-4xl font-extrabold text-indigo-600 sm:text-5xl">
                            {totalKehadiranTahunan}
                          </p>
                          <p className="mt-2 text-xs text-indigo-600">
                            akumulasi total presensi
                          </p>
                        </div>

                        {/* Kartu 2: Total Status Aktif */}
                        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center sm:p-6">
                          <p className="mb-2 text-xs font-semibold text-green-700 sm:text-sm">
                            Total Status Aktif
                          </p>
                          <p className="text-4xl font-extrabold text-green-600 sm:text-5xl">
                            {totalAktifTahunan}
                          </p>
                          <p className="mt-2 text-xs text-green-600">
                            akumulasi status aktif
                          </p>
                        </div>

                        {/* Kartu 3: Total Status Jarang Hadir */}
                        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4 text-center sm:p-6">
                          <p className="mb-2 text-xs font-semibold text-yellow-700 sm:text-sm">
                            Total Jarang Hadir
                          </p>
                          <p className="text-4xl font-extrabold text-yellow-600 sm:text-5xl">
                            {totalJarangHadirlahTahunan}
                          </p>
                          <p className="mt-2 text-xs text-yellow-600">
                            akumulasi status jarang hadir
                          </p>
                        </div>

                        {/* Kartu 4: Total Status Tidak Aktif */}
                        <div className="rounded-xl border-2 border-red-300 bg-red-100 p-4 text-center sm:p-6">
                          <p className="mb-2 text-xs font-semibold text-red-700 sm:text-sm">
                            Total Tidak Aktif
                          </p>
                          <p className="text-4xl font-extrabold text-red-600 sm:text-5xl">
                            {totalTidakAktifTahunan}
                          </p>
                          <p className="mt-2 text-xs text-red-600">
                            akumulasi status tidak aktif
                          </p>
                        </div>

                        {/* Kartu 5: Rata-Rata Kehadiran Per Bulan */}
                        <div className="rounded-xl border-2 border-gray-300 bg-gray-100 p-4 text-center sm:p-6">
                          <p className="mb-2 text-xs font-semibold text-gray-700 sm:text-sm">
                            Rata-rata Jemaat Hadir/Bulan
                          </p>
                          <p className="text-4xl font-extrabold text-gray-600 sm:text-5xl">
                            {rataRataKehadiranPerBulan}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            jemaat unik per bulan
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Kalender - Pilih Tanggal untuk Detail Statistik (Sudah diperbaiki untuk Multi-Select) */}
                <section className="mb-10">
                  <h2 className="mb-4 flex items-center text-xl font-bold text-indigo-700 md:text-2xl">
                    <Calendar size={20} className="mr-2" /> Pilih Tanggal untuk
                    Detail Statistik
                  </h2>
                  <p className="mb-6 text-sm text-gray-600">
                    <span className="inline-flex items-center">
                      <span className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></span>
                      Tanggal dengan titik biru adalah hari yang memiliki data
                      kehadiran aktual.
                    </span>
                    <br />
                    <span className="font-semibold text-red-600">
                      *Klik tanggal untuk menambah/menghapus dari seleksi.
                      Statistik di bawah akan mengakumulasi semua tanggal yang
                      dipilih.
                    </span>
                  </p>

                  {/* Navigasi Bulan/Tahun untuk Kalender Detail (Tampilan Tahun) */}
                  <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-3 shadow-md sm:p-5">
                    <button
                      onClick={handleDetailPrevMonth}
                      className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100 sm:p-3"
                    >
                      <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>

                    <div className="relative">
                      {/* PERUBAHAN: Tampilkan hanya Tahun, dan klik akan membuka pemilih tahun */}
                      <button
                        onClick={handleOpenDetailYearPicker}
                        className="rounded-lg px-3 py-1 text-lg font-bold text-gray-800 transition hover:bg-indigo-50 hover:text-indigo-600 sm:px-6 sm:py-2 sm:text-2xl"
                      >
                        Tahun {detailYear}
                      </button>

                      {/* MODAL YEAR PICKER DETAIL */}
                      {showDetailYearPicker && (
                        <div className="absolute top-full left-1/2 z-10 mt-2 min-w-[300px] -translate-x-1/2 transform rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:min-w-[400px]">
                          <div className="mb-4 flex items-center justify-between">
                            <button
                              onClick={() =>
                                setGridStartYear((prev) => prev - 10)
                              }
                              className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <span className="text-lg font-semibold text-gray-700">
                              {gridStartYear} - {gridStartYear + 9}
                            </span>
                            <button
                              onClick={() =>
                                setGridStartYear((prev) => prev + 10)
                              }
                              className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-3">
                            {yearsForPicker.map((y) => (
                              <button
                                key={y}
                                onClick={() => handleDetailYearChange(y)}
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition sm:text-base ${
                                  y === detailYear
                                    ? "bg-indigo-600 text-white shadow-lg"
                                    : "border border-gray-200 text-gray-700 hover:bg-indigo-100"
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                          <div className="mt-6 flex justify-center">
                            <button
                              onClick={() => setShowDetailYearPicker(false)}
                              className="rounded-lg border-2 border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50"
                            >
                              Tutup
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleDetailNextMonth}
                      className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100 sm:p-3"
                    >
                      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
                    {monthsToDisplay.map(({ monthIndex, year }) => {
                      const daysInMonth = getDaysInMonth(monthIndex, year);
                      const firstDay = getFirstDayOfMonth(monthIndex, year);
                      const startDayOffset = firstDay === 0 ? 6 : firstDay - 1;
                      const daysArray = [
                        ...Array.from({ length: startDayOffset }, () => null),
                        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                      ];
                      const datesWithStats = getDatesWithStats(
                        monthIndex,
                        year,
                        actualAttendanceSet,
                      ); // Digunakan untuk DOT

                      return (
                        <div
                          key={`${year}-${monthIndex}`}
                          className="rounded-xl border-2 border-gray-200 bg-white p-5 shadow-md transition hover:shadow-lg"
                        >
                          <h4 className="mb-4 text-center text-lg font-bold text-indigo-600">
                            {monthNames[monthIndex]} {year}
                          </h4>
                          <div className="mb-3 grid grid-cols-7 text-xs font-semibold text-gray-500">
                            {[
                              "Sen",
                              "Sel",
                              "Rab",
                              "Kam",
                              "Jum",
                              "Sab",
                              "Min",
                            ].map((d) => (
                              <div key={d} className="text-center">
                                {d}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
                            {daysArray.map((day, i) => {
                              if (day === null)
                                return <div key={i} className="p-2"></div>;
                              const thisDate = new Date(year, monthIndex, day);
                              const dayKey = getDayKey(thisDate);
                              const isSelected = selectedDatesKeys.includes(dayKey);
                              const dateTimestamp = new Date(thisDate).setHours(
                                0,
                                0,
                                0,
                                0,
                              );
                              const isFuture = dateTimestamp > todayStart;

                              const hasStats = datesWithStats.has(dayKey);

                              const handleClick = () => {
  // UBAH: Izinkan klik tanpa mempedulikan isFuture
  handleSelectDate(day, monthIndex);
};

                              return (
                                <div
    key={i}
    className={`relative rounded-lg p-2.5 font-medium transition-all duration-200 cursor-pointer ${
      isSelected
        ? "scale-110 bg-red-500 font-bold text-white shadow-lg ring-2 ring-red-300"
        : "text-gray-800 hover:scale-105 hover:bg-indigo-100"
        // Hapus pengecekan isFuture agar warna tidak abu-abu dan tetap aktif
    }`}
    onClick={() => handleSelectDate(day, monthIndex)}
  >
    {day}
    
    {/* Titik indikator akan muncul di tanggal MANA PUN (masa lalu/depan) 
        asalkan data (hasStats) ditemukan dan tanggal sedang tidak terpilih */}
    {hasStats && !isSelected && (
      <div className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-indigo-500"></div>
    )}
  </div>
);
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Grafik Detail Tanggal (Multi-Select) */}
                {selectedDatesKeys.length > 0 &&
                totalHadirUnikSelectedDates > 0 ? (
                  <section className="mt-8">
                    <div className="mb-4 flex items-center justify-between border-b-2 pb-2">
                      <h2 className="text-xl font-bold text-red-600 md:text-2xl">
                        Detail Kehadiran: {selectedDatesKeys.length} Tanggal
                        Dipilih ({selectedDatesDisplay})
                      </h2>
                    </div>

                    {/* 1. Total Kehadiran Semua Ibadah (Satu Kartu Gabungan) */}
                    <div className="mx-auto mb-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border-2 border-red-300 bg-red-100 p-6 shadow-md">
                        <p className="text-sm text-red-700">
                          Total Jemaat Unik Hadir
                        </p>
                        <p className="mt-1 text-5xl font-extrabold text-red-600">
                          {totalHadirUnikSelectedDates}
                        </p>
                        <p className="text-xs text-red-500">
                          Total akumulatif jemaat unik yang hadir di{" "}
                          {selectedDatesKeys.length} tanggal
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-blue-300 bg-blue-100 p-6 shadow-md">
                        <p className="text-sm text-blue-700">
                          Persentase Kehadiran
                        </p>
                        <p className="mt-1 text-5xl font-extrabold text-blue-600">
                          {combinedPresentaseKehadiran}
                        </p>
                        <p className="text-xs text-blue-500">
                          Dari total potensi jemaat{" "}
                          {totalPotentialAttendeesCombined} orang
                        </p>
                      </div>
                    </div>

                    {/* 2. Total Kehadiran di Masing-Masing Kebaktian (Dynamic Cards Gabungan) */}
                    <div className="mb-8">
                      <h3 className="mb-4 border-b pb-2 text-xl font-bold text-gray-700">
                        Total Kehadiran per Sesi Kebaktian (Akumulatif)
                      </h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {Object.entries(combinedKehadiranBySesi)
                          .sort(([, a], [, b]) => b - a)
                          .map(([sessionName, count]) => {
                            const isHovered = hoveredSession === sessionName;
                            const cleanSessionName =
                              getCleanSessionName(sessionName);
                            const highlight = isHovered;

                            return (
                              <div
                                key={sessionName}
                                className={`cursor-default rounded-xl border p-4 shadow-md transition-all duration-300 ${
                                  highlight
                                    ? "scale-105 border-indigo-500 bg-indigo-200 shadow-lg"
                                    : "border-indigo-200 bg-white"
                                } `}
                                onMouseEnter={() =>
                                  setHoveredSession(sessionName)
                                }
                                onMouseLeave={() => setHoveredSession(null)}
                              >
                                <p
                                  className="truncate text-sm font-semibold text-indigo-700"
                                  title={sessionName}
                                >
                                  {cleanSessionName}
                                </p>
                                <p className="mt-1 text-3xl font-extrabold text-gray-800">
                                  {count}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {sessionName
                                    .replace(cleanSessionName, "")
                                    .trim() || "orang hadir"}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* 3. Menampilkan chart di bawah */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* CHART 1: LINE CHART - Status Trend Per Session (AKUMULATIF & FILTERED) */}
                      <SessionLineChart
                        // MENGGUNAKAN LOGIKA AKUMULASI YANG BARU
                        data={combinedStatusBySession}
                        hoveredSession={hoveredSession}
                        setHoveredSession={setHoveredSession}
                        selectedDatesKeys={selectedDatesKeys}
                      />
                      {/* CHART 2: Distribusi Kehadiran Sesi (Pie Chart) - Menggunakan komponen PieChartCard yang sudah diperbaiki logic legend-nya */}
                      <PieChartCard
                        title="Distribusi Kehadiran Berdasarkan Sesi (Akumulatif)"
                        data={combinedKehadiranBySesi}
                        description={`Jumlah kehadiran per sesi ibadah dari ${selectedDatesKeys.length} tanggal yang dipilih.`}
                        hoveredSession={hoveredSession}
                        setHoveredSession={setHoveredSession}
                      />
                    </div>

                    {/* NEW: Rincian Per Tanggal (Sudah diperbaiki dengan chart dan total hadir di judul) */}
                    {selectedDatesKeys.length > 0 && (
                      <div className="mt-8 border-t border-gray-300 pt-6">
                        <h3 className="mb-4 text-xl font-bold text-indigo-700">
                          Rincian Per Tanggal
                        </h3>
                        <div className="space-y-6">
                          {/* Filter hanya tanggal yang memiliki data di dateStatsMap */}
                          {selectedDatesKeys
                            .filter((dateKey) => dateStatsMap[dateKey])
                            .map((dateKey) => {
                              const stats = dateStatsMap[dateKey];
                              if (!stats) return null;

                              // Data untuk Pie Chart Kehadiran Sesi per Tanggal
                              const singleDatePieData = Object.entries(
                                stats.kehadiranBySesi,
                              ).map(([name, value]) => ({
                                name,
                                value,
                                fullSessionName: name,
                              }));

                              // Data untuk Line Chart Status Per Tanggal (Data Baru dari statusKehadiranBySesi)
                              const singleDateStatusData = Object.entries(
                                stats.statusKehadiranBySesi,
                              )
                                .map(([session, statuses]) => ({
                                  session: getShortSessionName(session),
                                  fullSessionName: session,
                                  Aktif: statuses.Aktif || 0,
                                  "Jarang Hadir": statuses["Jarang Hadir"] || 0,
                                  "Tidak Aktif": statuses["Tidak Aktif"] || 0,
                                }))
                                .filter(
                                  (item) =>
                                    item.Aktif > 0 ||
                                    item["Jarang Hadir"] > 0 ||
                                    item["Tidak Aktif"] > 0,
                                );

                              return (
                                <div
                                  key={dateKey}
                                  className="rounded-xl border-2 border-gray-100 bg-white p-5 shadow-lg"
                                >
                                  <h4 className="mb-3 text-lg font-bold text-indigo-600">
                                    {new Date(dateKey).toLocaleDateString(
                                      "id-ID",
                                      {
                                        weekday: "long",
                                        day: "2-digit",
                                        month: "long",
                                        year: "numeric",
                                      },
                                    )}
                                    {/* Tampilkan Total Hadir di Judul */}
                                    <span className="ml-3 text-sm font-normal text-gray-500">
                                      (Jemaat Unik Hadir:{" "}
                                      {stats?.totalHadir ?? 0})
                                    </span>
                                  </h4>

                                  {/* Ringkasan Kartu Per Tanggal */}
                                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <div className="rounded-lg bg-red-50 p-3">
                                      <p className="text-sm text-red-700">
                                        Jemaat Unik Hadir
                                      </p>
                                      <p className="text-2xl font-bold text-red-600">
                                        {stats.totalHadir}
                                      </p>
                                    </div>
                                    <div className="rounded-lg bg-green-50 p-3">
                                      <p className="text-sm text-green-700">
                                        Sesi Terbanyak
                                      </p>
                                      <p
                                        className="text-md truncate font-semibold text-green-700"
                                        title={
                                          Object.entries(
                                            stats.kehadiranBySesi,
                                          ).sort(
                                            ([, a], [, b]) => b - a,
                                          )[0]?.[0] ?? "N/A"
                                        }
                                      >
                                        {getCleanSessionName(
                                          Object.entries(
                                            stats.kehadiranBySesi,
                                          ).sort(
                                            ([, a], [, b]) => b - a,
                                          )[0]?.[0] ?? "N/A",
                                        )}
                                      </p>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-3">
                                      <p className="text-sm text-blue-700">
                                        Persentase
                                      </p>
                                      <p className="text-2xl font-bold text-blue-600">
                                        {stats.presentaseKehadiran}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Chart Detail Per Tanggal */}
                                  {singleDatePieData.length > 0 ? (
                                    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                                      {/* Line Chart Status Per Tanggal (Menggantikan Bar Chart) */}
                                      <SingleDateStatusLineChart
                                        data={singleDateStatusData}
                                      />

                                      {/* Pie Chart Sesi per Tanggal (Menggunakan PieChartCard yang sudah diperbaiki logic legend-nya) */}
                                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-inner">
                                        <h5 className="mb-4 border-b pb-2 text-lg font-bold text-gray-800">
                                          Persentase Kehadiran Sesi
                                        </h5>
                                        <ResponsiveContainer
                                          width="100%"
                                          height={250}
                                        >
                                          <PieChart
                                            margin={{
                                              top: 5,
                                              right: 10,
                                              left: 10,
                                              bottom: 5,
                                            }}
                                          >
                                            <Pie
                                              data={singleDatePieData}
                                              cx="50%"
                                              cy="50%"
                                              labelLine={false}
                                              label={false} // Menonaktifkan label di slices
                                              outerRadius={80} // Disesuaikan
                                              fill="#8884d8"
                                              dataKey="value"
                                            >
                                              {singleDatePieData.map(
                                                (entry, index) => (
                                                  <Cell
                                                    key={`cell-${index}`}
                                                    fill={
                                                      COLORS[
                                                        index % COLORS.length
                                                      ]
                                                    }
                                                  />
                                                ),
                                              )}
                                            </Pie>
                                            <Tooltip
                                              formatter={(
                                                value: unknown,
                                                name: string,
                                              ) => {
                                                if (
                                                  value === null ||
                                                  value === undefined
                                                )
                                                  return [
                                                    "Tidak Ada Data",
                                                    name,
                                                  ];
                                                if (Array.isArray(value))
                                                  return [
                                                    `${value.join(", ")} orang`,
                                                    name,
                                                  ];
                                                if (typeof value === "object")
                                                  return [
                                                    JSON.stringify(value),
                                                    name,
                                                  ];
                                                if (
                                                  typeof value === "object" &&
                                                  value !== null
                                                ) {
                                                  return [
                                                    JSON.stringify(value) +
                                                      " orang",
                                                    name,
                                                  ];
                                                }
                                                if (typeof value === "number")
                                                  return [
                                                    `${value} orang`,
                                                    name,
                                                  ];
                                                return ["Tidak Ada Data", name];
                                              }}
                                            />

                                            <Legend
                                              layout="horizontal"
                                              align="center"
                                              verticalAlign="bottom"
                                              wrapperStyle={{
                                                paddingTop: "0px",
                                                marginBottom: "-10px",
                                              }}
                                              content={renderLegend} // Menggunakan custom render legend
                                            />
                                          </PieChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-4 text-center text-gray-500">
                                      Tidak ada data kehadiran untuk tanggal
                                      ini.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </section>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-lg">
                    <BarChart3 size={64} className="mb-4 text-gray-300" />
                    <p className="mb-2 text-xl text-gray-500">
                      Pilih minimal satu tanggal di kalender
                    </p>
                    <p className="text-sm text-gray-400">
                      Pilih hari untuk melihat detail statistik.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* MODAL YEAR PICKER GLOBAL */}
            {showYearPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-sm rounded-xl bg-white p-6">
                  <h3 className="mb-4 text-center text-xl font-bold text-gray-800">
                    Pilih Tahun
                  </h3>

                  <div className="mb-4 flex items-center justify-between">
                    <button
                      onClick={() => setGridStartYear((prev) => prev - 10)}
                      className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-lg font-semibold text-gray-700">
                      {gridStartYear} - {gridStartYear + 9}
                    </span>
                    <button
                      onClick={() => setGridStartYear((prev) => prev + 10)}
                      className="rounded-full p-2 text-indigo-600 transition hover:bg-indigo-100"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    {yearsForPicker.map((y) => (
                      <button
                        key={y}
                        onClick={() => handleYearChange(y)}
                        className={`rounded-lg px-4 py-3 text-sm font-semibold transition duration-150 ${
                          y === year
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-600"
                        } `}
                      >
                        {y}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setShowYearPicker(false)}
                      className="rounded-lg border-2 border-gray-300 px-6 py-2 text-gray-700 transition hover:bg-gray-50"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* END MODAL YEAR PICKER GLOBAL */}

            {/* LOADING DOWNLOAD */}
            {isDownloading && (
              <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
                <div className="rounded-xl bg-white p-6 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <Loader2
                      size={24}
                      className="animate-spin text-indigo-600"
                    />
                    <span className="text-lg font-semibold text-gray-800">
                      Memproses download PDF...
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* END LOADING DOWNLOAD */}
          </div>
        </main>
      </div>

      <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
