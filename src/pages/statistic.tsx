// src/pages/statistic.tsx

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { BarChart3, Calendar, ChevronLeft, ChevronRight, Download, Settings, X, Loader2, Menu } from "lucide-react"; 
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import 'jspdf-autotable'; // ⬅️ ini HARUS langsung setelah jsPDF


// 🩹 Patch global untuk menghindari error oklch di runtime
if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('color', 'oklch(50% 0.2 200)')) {
  console.warn('⚠️ Browser tidak mendukung OKLCH, warna akan dikonversi otomatis.');
}


// --- Tipe Data ---
interface Jemaat {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif"; // Status kehadiran terhitung
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
  dokumen?: string; // NEW: Field untuk dokumen/gambar
  tanggalKehadiran: string; // Format: YYYY-MM-DD (dari API)
}

// Tipe response dari /api/jemaat
interface JemaatAPIResponse {
    jemaatData: Jemaat[];
    attendanceDates: string[];
}

// --- Konstanta Kalender ---
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const today = new Date();
const currentMonth = today.getMonth(); 
const currentYear = today.getFullYear(); 
const todayStart = new Date(today).setHours(0, 0, 0, 0);


const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getMonthKey = (month: number, year: number): string => 
  `${year}-${String(month + 1).padStart(2, '0')}`;

const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

// Warna untuk chart
const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#4F46E5', '#8B5CF6', '#EC4899', '#3B82F6', '#A855F7'];

// --- Logika Statistik ---
const calculateOverallStats = (jemaat: Jemaat[]) => {
  if (jemaat.length === 0) {
    return { totalJemaat: 0, jabatanDistribution: {}, kehadiranDistribution: {} as Record<Jemaat['statusKehadiran'], number> };
  }
  
  const jabatanDistribution = jemaat.reduce((acc, j) => {
    acc[j.jabatan] = (acc[j.jabatan] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const kehadiranDistribution = jemaat.reduce((acc, j) => {
    acc[j.statusKehadiran] = (acc[j.statusKehadiran] || 0) + 1;
    return acc;
  }, {} as Record<Jemaat['statusKehadiran'], number>);

  return { totalJemaat: jemaat.length, jabatanDistribution, kehadiranDistribution };
};

// Fungsi untuk mendapatkan nama sesi pendek dari nama sesi lengkap
const getShortSessionName = (session: string) => {
    return session
        .replace("Kebaktian I", "K. I").replace("Kebaktian II", "K. II").replace("Kebaktian III", "K. III")
        .replace("Ibadah Anak", "I. Anak").replace("Ibadah Remaja", "I. Remaja")
        .replace("Ibadah Pemuda", "I. Pemuda").replace("Ibadah Lansia", "I. Lansia")
        .replace("Ibadah Dewasa", "I. Dewasa")
        .replace(/\s*:.*$/, '').replace(/ (Minggu|Sabtu)/, '').trim();
};

// Fungsi untuk mendapatkan nama sesi yang bersih (hanya jenis ibadah/kebaktian)
const getCleanSessionName = (session: string) => {
    return session
        .replace(/ \:.*$/, '') // Hapus waktu
        .replace(/ ,.*$/, '') // Hapus hari (jika ada koma)
        .replace(/ (Minggu|Sabtu)/, '') // Hapus hari (jika tidak ada koma)
        .trim();
}

/**
 * MODIFIKASI: Menghitung statistik berdasarkan status Kehadiran dan Sesi Kehadiran
 * tanpa menggunakan simulasi kehadiran acak. ASUMSI: Jemaat HADIR jika sesi kehadiran mereka
 * (kehadiranSesi) cocok dengan sesi yang tersedia di tanggal yang dipilih DAN JEMAAT MEMILIKI DATA KEHADIRAN DI TANGGAL TERSEBUT.
 * @param jemaatList 
 * @param selectedDate 
 * @returns 
 */
const calculateDateStats = (jemaatList: Jemaat[], selectedDate: string) => {
  // Hanya filter jemaat yang tercatat hadir pada tanggal yang dipilih
  const jemaatHadirDiTanggalIni = jemaatList.filter(j => 
    getDayKey(new Date(j.tanggalKehadiran)) === selectedDate
  );

  const totalJemaat = jemaatHadirDiTanggalIni.length; // Total jemaat yang *hadir* di tanggal ini

  // 1. Tentukan sesi yang *seharusnya* ada di tanggal ini (untuk menghitung potensi)
  const dateObj = new Date(selectedDate);
  const dayOfWeek = dateObj.getDay(); // 0 = Minggu
  
  const availableSessions = new Set<string>();
  if (dayOfWeek === 0) { // Minggu
      ["Kebaktian I : 07:00", "Kebaktian II : 10:00", "Kebaktian III : 17:00", "Ibadah Anak : Minggu, 10:00", "Ibadah Remaja : Minggu, 10:00", "Ibadah Pemuda : Minggu, 10:00"].forEach(s => availableSessions.add(s));
  } else if (dayOfWeek === 6) { // Sabtu
      ["Ibadah Dewasa : Sabtu, 17:00", "Ibadah Lansia : Sabtu, 10:00"].forEach(s => availableSessions.add(s));
  }
  
  let totalKehadiranSemuaSesi = 0;
  // Potensi adalah jumlah jemaat yang SESINYA cocok dengan hari ini
  let totalPotentialAttendees = jemaatList.filter(j => 
      availableSessions.has(j.kehadiranSesi)
  ).length; 

  const kehadiranBySesi: Record<string, number> = {};
  const statusKehadiranBySesi: Record<string, Record<Jemaat['statusKehadiran'], number>> = {}; 

  // 2. Hitung distribusi berdasarkan jemaat yang HADIR di tanggal ini.
  jemaatHadirDiTanggalIni.forEach(jemaat => {
      // ASUMSI: Karena sudah difilter jemaat yang hadir, kita bisa langsung hitung
      const sesi = jemaat.kehadiranSesi;
      const status = jemaat.statusKehadiran;
      
      totalKehadiranSemuaSesi++;
      kehadiranBySesi[sesi] = (kehadiranBySesi[sesi] ?? 0) + 1;

      // Catat status jemaat yang hadir
      statusKehadiranBySesi[sesi] ??= { Aktif: 0, 'Jarang Hadir': 0, 'Tidak Aktif': 0 };
      statusKehadiranBySesi[sesi][status] = (statusKehadiranBySesi[sesi][status] || 0) + 1;
  });

  // Karena data jemaat yang masuk adalah data kehadiran, maka total kehadiran = total jemaat yang di filter.
  // Presentase dihitung terhadap POTENSI
  const presentaseKehadiran = totalPotentialAttendees > 0 
      ? `${((totalKehadiranSemuaSesi / totalPotentialAttendees) * 100).toFixed(1)}%`
      : "0%";

  return { 
    totalHadir: totalKehadiranSemuaSesi, 
    // Total tidak hadir sulit dihitung akurat tanpa mengetahui seluruh potensi database
    totalTidakHadir: totalPotentialAttendees - totalKehadiranSemuaSesi, 
    presentaseKehadiran, 
    kehadiranBySesi, 
    statusKehadiranBySesi, 
    totalKehadiranSemuaSesi,
    totalPotentialAttendees
  };
};

// Sesuaikan LegendPayload supaya kompatibel dengan Recharts (value bisa string|number, color optional)
interface LegendPayload {
  value: string | number;
  color?: string;
}

// Ganti definisi renderLegend lama dengan ini
const renderLegend = (props: any): React.ReactElement | null => {
  const payload = props?.payload ?? [];
  if (!payload || payload.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      fontSize: '12px',
      lineHeight: '1.2'
    }}>
      {payload.map((entry: any, index: number) => (
        <div
          key={`item-${index}`}
          style={{
            color: entry?.color ?? '#000',
            margin: '0 8px 4px 8px',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              backgroundColor: entry?.color ?? '#000',
              borderRadius: '50%',
              marginRight: 6
            }}
          />
          {String(entry?.value ?? '')}
        </div>
      ))}
    </div>
  );
};

// --- Komponen Chart ---

// Komponen Line Chart untuk Tren Kehadiran per Sesi (Detail Tanggal)
interface SessionLineChartProps {
  data: Array<{
    session: string;
    fullSessionName: string;
    Aktif: number;
    'Jarang Hadir': number;
    'Tidak Aktif': number;
  }>;
  hoveredSession: string | null;
  setHoveredSession: (session: string | null) => void;
  selectedDatesKeys: string[];
}

const SessionLineChart = ({ data, hoveredSession, setHoveredSession, selectedDatesKeys }: SessionLineChartProps) => {
  const router = useRouter();

  // Handler untuk mengarahkan ke database dengan filter Tanggal + Sesi
  const handleChartClick = (state: { activePayload?: { payload: { fullSessionName: string } }[] } | null) => {
    if ((state?.activePayload ?? []).length > 0) {
      const sessionName = state?.activePayload?.[0]?.payload?.fullSessionName;
      if (!sessionName) return;
      
      // Navigasi dengan parameter multi-tanggal dan filter event
      const datesParam = selectedDatesKeys.join(',');
      void router.push(`/database?dates=${datesParam}&event=${encodeURIComponent(sessionName)}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
            Tren Status Kehadiran per Sesi Kebaktian (Akumulatif)
        </h3>
        <p className="text-sm text-gray-500 mb-4">
            <span className="font-semibold text-indigo-600">Klik titik pada grafik untuk melihat detail tabel di Database!</span>
        </p>
        <ResponsiveContainer width="100%" height={280}>
            <LineChart 
                data={data} 
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                onMouseDown={(state) => {
                  const activePayload = (state as any)?.activePayload;
                  if (activePayload && activePayload.length > 0) {
                    const sessionName = activePayload[0].payload.fullSessionName;
                    handleChartClick({ activePayload: [{ payload: { fullSessionName: sessionName } }] });
                  }
                }} // Adjusted to match the expected type
                style={{ cursor: 'pointer' }}
                onMouseEnter={(state: any) => {
                  if (state?.activePayload && state.activePayload.length > 0) {
                    setHoveredSession(state.activePayload[0].payload.fullSessionName);
                  }
                }}
                onMouseLeave={() => setHoveredSession(null)}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="session" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" // Diatur agar garis mulus
                  dataKey="Aktif" 
                  stroke="#10B981" 
                  strokeWidth={2} 
                  name="Aktif" 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 8 }} 
                  opacity={hoveredSession === null || data.some((d: any) => d.fullSessionName === hoveredSession) ? 1 : 0.5}
                />
                <Line 
                  type="monotone" // Diatur agar garis mulus
                  dataKey="Jarang Hadir" 
                  stroke="#F59E0B" 
                  strokeWidth={2} 
                  name="Jarang Hadir" 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 8 }} 
                  opacity={hoveredSession === null || data.some((d: any) => d.fullSessionName === hoveredSession) ? 1 : 0.5}
                />
                <Line 
                  type="monotone" // Diatur agar garis mulus
                  dataKey="Tidak Aktif" 
                  stroke="#EF4444" 
                  strokeWidth={2} 
                  name="Tidak Aktif" 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 8 }} 
                  opacity={hoveredSession === null || data.some((d: any) => d.fullSessionName === hoveredSession) ? 1 : 0.5}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

// Komponen Line Chart Status Kehadiran Per Sesi untuk Rincian Tanggal
const SingleDateStatusLineChart = ({ data }: { data: any[] }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-inner border border-gray-200">
            <h5 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
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
                    <Line type="monotone" dataKey="Aktif" stroke="#10B981" strokeWidth={2} name="Aktif" dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Jarang Hadir" stroke="#F59E0B" strokeWidth={2} name="Jarang Hadir" dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Tidak Aktif" stroke="#EF4444" strokeWidth={2} name="Tidak Aktif" dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};


// Komponen Line Chart untuk Tampilan Bulanan (Timeseries Harian)
const MonthLineChart = ({ data, month, year }: any) => {
    const router = useRouter();
    const today = new Date();
    const todayKey = today.getDate();
    const currentMonthKey = today.getMonth();
    const currentYearKey = today.getFullYear();

    const handleDailyChartClick = (state: any) => {
        if (state?.activeLabel) {
            const day = state.activeLabel;
            
            // Format tanggal yang diklik: YYYY-MM-DD
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // NAVIGASI DENGAN PARAMETER YANG JELAS: dates=YYYY-MM-DD
            void router.push(`/database?dates=${dateKey}`);
        }
    };
    
    // Tentukan hari terakhir yang datanya valid (tidak boleh melewati hari ini)
    let maxDay = getDaysInMonth(month, year);
    if (year === currentYearKey && month === currentMonthKey) {
        maxDay = todayKey;
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">
                Tren Status Kehadiran Per Tanggal
            </h3>
            <p className="text-sm text-gray-500 mb-4">
                <span className="font-semibold text-indigo-600">Klik titik pada grafik untuk melihat detail tabel di hari tersebut!</span>
            </p>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                    data={data} 
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                    onMouseDown={handleDailyChartClick}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="hari" 
                        allowDecimals={false} 
                        domain={[1, maxDay]} 
                        ticks={Array.from({ length: Math.min(maxDay, 15) }, (_, i) => i * (Math.floor(maxDay / 15) || 1) + 1).filter(d => d <= maxDay)}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      formatter={(value: unknown, name: string) => {
                        if (value === null || value === undefined) return ['Tidak Ada Data', name];
                        if (Array.isArray(value)) return [value.join(', '), name];
                        return [String(value), name];
                      }}
                      labelFormatter={(label: number) => `Tanggal ${label} ${monthNames[month]}`}
                    />
                    <Legend />
                    {/* connectNulls=true untuk garis yang menyambung */}
                    <Line type="monotone" dataKey="aktif" stroke="#10B981" strokeWidth={2} name="Aktif" connectNulls={true} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="jarangHadirlah" stroke="#F59E0B" strokeWidth={2} name="Jarang Hadir" connectNulls={true} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="tidakAktif" stroke="#EF4444" strokeWidth={2} name="Tidak Aktif" connectNulls={true} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};


// Komponen Bar Chart (hanya digunakan untuk Distribusi Jabatan)
const BarChartCard = ({ title, data, description }: any) => {
  const chartData = Object.entries(data).map(([name, value], index) => ({ 
    name, 
    value, 
    fill: COLORS[index % COLORS.length] 
  }));
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg h-full">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#4F46E5" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Komponen Pie Chart (DIPERBAIKI TATA LETAK LEGENDA)
const PieChartCard = ({ title, data, description, hoveredSession, setHoveredSession }: any) => {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value, fullSessionName: name }));

  const handleMouseEnter = (entry: any) => {
    setHoveredSession(entry.fullSessionName);
  };

  const handleMouseLeave = () => {
    setHoveredSession(null);
  };
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg h-full">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
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
                opacity={hoveredSession === null || hoveredSession === entry.fullSessionName ? 1 : 0.5}
                onMouseEnter={() => handleMouseEnter(entry)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: string) => {
              if (value === null || value === undefined) return ['Tidak Ada Data', name];
              if (Array.isArray(value)) return [`${value.join(', ')} orang`, name];
              return [`${String(value)} orang`, name];
            }}
          />
          <Legend 
            layout="horizontal" 
            align="center" 
            verticalAlign="bottom" 
            wrapperStyle={{ paddingTop: '0px', marginBottom: '-30px' }}
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
  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const contentRef = useRef<HTMLDivElement>(null);
  

  // --- State Sidebar Toggle ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // DEKLARASI TUNGGAL

  // --- Start Month/Year untuk Tampilan Detail Statistik ---
  const [detailYear, setDetailYear] = useState(currentYear);
  const [detailStartMonth, setDetailStartMonth] = useState(currentMonth);
  // NEW STATE: Mendukung multiple tanggal dari URL atau klik
  const [selectedDatesKeys, setSelectedDatesKeys] = useState<string[]>([]); 

  const [year, setYear] = useState(currentYear); // Year untuk Navigasi Bulanan Global/Tahunan
  const [startMonth, setStartMonth] = useState(currentMonth);
  
  // Perubahan state untuk Year Picker
  const [showYearPicker, setShowYearPicker] = useState(false); // Untuk mode Bulanan/Tahunan
  const [showDetailYearPicker, setShowDetailYearPicker] = useState(false); // Untuk Kalender Detail
  const [gridStartYear, setGridStartYear] = useState(Math.floor(currentYear / 10) * 10); // Untuk Year Picker
  
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  const [isDownloading, setIsDownloading] = useState(false); // State untuk loading download
  const [actualAttendanceDates, setActualAttendanceDates] = useState<string[]>([]); // NEW STATE: Simpan tanggal kehadiran aktual dari API
  
  // Mengambil data dari /api/jemaat
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat");
        if (!res.ok) throw new Error("Gagal fetch data jemaat");

        const data: unknown = await res.json();
        
        // --- START FIX: Mengakomodasi format response API baru ---
        const apiResponse = data as JemaatAPIResponse;
        
        if (Array.isArray(apiResponse.jemaatData) && apiResponse.jemaatData.length > 0) {
          setJemaat(apiResponse.jemaatData);
          setActualAttendanceDates(apiResponse.attendanceDates); // Simpan tanggal kehadiran aktual
        } else {
          throw new Error("Data jemaat tidak valid atau kosong");
        }
        // --- END FIX ---
      } catch (err) {
        console.error("Error fetch jemaat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  // NEW: Handle query parameter untuk multiple selected dates dari URL
  useEffect(() => {
    if (!router.isReady) return; 

    const { dates } = router.query;

    if (typeof dates === 'string' && dates.length > 0) {
      const datesArray = dates.split(',').filter(d => /^\d{4}-\d{2}-\d{2}$/.exec(d));
      setSelectedDatesKeys(datesArray);
      
if (datesArray.length > 0) {
  // Ambil nilai pertama dengan guard yang jelas
  const firstIso = datesArray[0];
    if (firstIso) {
      const firstDate = new Date(firstIso);
      if (!isNaN(firstDate.getTime())) {
        setDetailYear(firstDate.getFullYear());
        setDetailStartMonth(firstDate.getMonth());
        
        // Atur juga startMonth/year untuk tampilan keseluruhan
        setYear(firstDate.getFullYear());
        setStartMonth(firstDate.getMonth());
      }
    }
  }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);


  const overallStats = useMemo(() => calculateOverallStats(jemaat), [jemaat]);
  
  // --- LOGIKA MULTI-DATE STATS ---
  const dateStatsMap = useMemo(() => {
    if (selectedDatesKeys.length === 0) return {};
    
    const stats: Record<string, ReturnType<typeof calculateDateStats>> = {};
    
    selectedDatesKeys.forEach(dateKey => {
      // Hanya hitung statistik jika ada data kehadiran yang tercatat untuk tanggal ini
      if (actualAttendanceDates.includes(dateKey)) {
        stats[dateKey] = calculateDateStats(jemaat, dateKey);
      }
    });
    
    return stats;
  }, [jemaat, selectedDatesKeys, actualAttendanceDates]);

  const totalKehadiranSelectedDates = useMemo(() => {
      return Object.values(dateStatsMap).reduce((sum, stats) => 
          sum + stats.totalKehadiranSemuaSesi, 0
      );
  }, [dateStatsMap]);
  
  const combinedKehadiranBySesi = useMemo(() => {
      const combined: Record<string, number> = {};
      Object.values(dateStatsMap).forEach(stats => {
          Object.entries(stats.kehadiranBySesi).forEach(([session, count]) => {
              combined[session] = (combined[session] || 0) + count;
          });
      });
      return combined;
  }, [dateStatsMap]);

  const selectedDatesDisplay = useMemo(() => {
      return selectedDatesKeys
          .map(key => new Date(key).toLocaleDateString("id-ID", { day: "2-digit", month: "long" }))
          .join(', ');
  }, [selectedDatesKeys]);

  const totalPotentialAttendeesCombined = useMemo(() => {
    return Object.values(dateStatsMap).reduce((sum, stats) => sum + stats.totalPotentialAttendees, 0);
  }, [dateStatsMap]);
  
  const combinedPresentaseKehadiran = totalPotentialAttendeesCombined > 0 
    ? `${((totalKehadiranSelectedDates / totalPotentialAttendeesCombined) * 100).toFixed(1)}%`
    : "0%";
  
    /**
     * LOGIKA BARU: Mengakumulasi status kehadiran (Aktif, Jarang Hadir, Tidak Aktif) 
     * DARI SEMUA JEMAAT YANG HADIR di sesi-sesi pada tanggal yang dipilih.
     */
    const combinedStatusBySession = useMemo(() => {
        const combined: Record<string, Record<Jemaat['statusKehadiran'], number>> = {};
        
        // Akumulasi data statusKehadiranBySesi dari semua tanggal yang dipilih
        Object.values(dateStatsMap).forEach(stats => {
            Object.entries(stats.statusKehadiranBySesi).forEach(([session, statusCounts]) => {
                combined[session] ??= { Aktif: 0, 'Jarang Hadir': 0, 'Tidak Aktif': 0 };
                
                combined[session].Aktif += statusCounts.Aktif || 0;
                combined[session]['Jarang Hadir'] += statusCounts['Jarang Hadir'] || 0;
                combined[session]['Tidak Aktif'] += statusCounts['Tidak Aktif'] || 0;
            });
        });

        // Transformasi data untuk Recharts LineChart
        const chartData = Object.entries(combined)
            .map(([session, statuses]) => ({
                session: getShortSessionName(session),
                fullSessionName: session,
                Aktif: statuses.Aktif,
                'Jarang Hadir': statuses['Jarang Hadir'],
                'Tidak Aktif': statuses['Tidak Aktif'],
            }))
            .filter(item => item.Aktif > 0 || item['Jarang Hadir'] > 0 || item['Tidak Aktif'] > 0);
            
        return chartData;
    }, [dateStatsMap]);
  
  // --- END LOGIKA MULTI-DATE STATS ---
  
  // --- MOCK LOGIC FOR OVERALL VIEW (Monthly/Yearly) ---
  // Simulasi data statistik bulanan & tahunan (Dibuat lebih sederhana dan konsisten dengan overallStats)
  const generateMockOverallTrends = (jemaatCount: number) => {
    const months = monthNames.map(name => name.substring(0, 3));
    const currentYearStats = months.map((bulan, index) => {
        // Menggunakan persentase yang mendekati 140/200, 40/200, 20/200 
        const baseActive = Math.round(jemaatCount * (0.6 + Math.random() * 0.1));
        const baseRare = Math.round(jemaatCount * (0.2 + Math.random() * 0.05));
        const baseInactive = jemaatCount - baseActive - baseRare;
        return { 
          bulan, 
          aktif: baseActive, 
          jarangHadirlah: baseRare, 
          tidakAktif: baseInactive,
          total: baseActive + baseRare + baseInactive // Total Kehadiran untuk Bulan ini
        };
    });
    return {
        "2025": currentYearStats,
        "2024": currentYearStats.map(s => ({ ...s, aktif: s.aktif - 5, tidakAktif: s.tidakAktif + 5 })),
    };
  }

  /**
   * MODIFIKASI: Simulasi data harian untuk Line Chart Bulanan.
   * Menggunakan distribusi status dari jemaat yang sesinya cocok dengan hari yang bersangkutan.
   * @param month 
   * @param year 
   * @param overallStats 
   * @returns 
   */
  const generateMockDailyTrends = (month: number, year: number, overallStats: { aktif: number, jarangHadirlah: number, tidakAktif: number, total: number }) => {
    const daysInMonth = getDaysInMonth(month, year);
    const data = [];
    
    let maxDay = daysInMonth;
    if (year === currentYear && month === currentMonth) {
      maxDay = today.getDate();
    }

    for (let day = 1; day <= daysInMonth; day++) {
      if (day > maxDay) {
        data.push({ hari: day, aktif: null, jarangHadirlah: null, tidakAktif: null });
        continue;
      }
      
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0 = Minggu, 6 = Sabtu
      const dateKey = getDayKey(date);

      let aktif = null;
      let jarangHadirlah = null;
      let tidakAktif = null;

      // HANYA hitung data jika ada kehadiran aktual di hari itu
      if (actualAttendanceDates.includes(dateKey)) {
          // Filter jemaat yang HADIR di tanggal ini (diasumsikan data jemaat sudah mencakup filter tanggal)
          const filteredJemaat = jemaat.filter(j => j.tanggalKehadiran === dateKey);
          
          const stats = calculateOverallStats(filteredJemaat).kehadiranDistribution;
          
          aktif = stats.Aktif ?? 0;
          jarangHadirlah = stats['Jarang Hadir'] ?? 0;
          tidakAktif = stats['Tidak Aktif'] ?? 0;
      }
      
      data.push({
        hari: day,
        aktif: aktif,
        jarangHadirlah: jarangHadirlah,
        tidakAktif: tidakAktif,
      });
    }
    return data;
  }

  const yearlyStats = useMemo(() => generateMockOverallTrends(overallStats.totalJemaat || 200), [overallStats.totalJemaat]);

  const currentMonthStats = useMemo(() => {
    const monthLabel = monthNames[startMonth] ?? '';
    const monthName = monthLabel.substring(0, 3);
    const arr = (yearlyStats[year.toString() as keyof typeof yearlyStats] ?? []) as Array<{ bulan: string; aktif: number; jarangHadirlah: number; tidakAktif: number; total: number }>;
    const found = arr.find(m => m.bulan === monthName);
    return found ?? { aktif: 0, jarangHadirlah: 0, tidakAktif: 0, total: 0 };
  }, [year, startMonth, yearlyStats]);
  
  const currentYearStats = useMemo(() => {
    let stats = yearlyStats[year.toString() as keyof typeof yearlyStats] || [];
    
    // LOGIKA PERBAIKAN: Batasi data Line Chart Tahunan
    if (year === currentYear) {
      // Potong data hingga bulan saat ini
      stats = stats.slice(0, currentMonth + 1); 
    }
    
    return stats; 
  }, [year, yearlyStats, currentMonth]);
  
  // NEW LOGIC: Hitung total dan rata-rata dari data Line Chart Tahunan yang sudah difilter/dipotong
  const totalAktifTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.aktif, 0);
  }, [currentYearStats]);
  
  // PERBAIKAN: Hitung Total Jarang Hadir Tahunan
  const totalJarangHadirlahTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.jarangHadirlah, 0);
  }, [currentYearStats]);

  const totalTidakAktifTahunan = useMemo(() => {
    return currentYearStats.reduce((sum, month) => sum + month.tidakAktif, 0);
  }, [currentYearStats]);

  const totalKehadiranTahunan = useMemo(() => {
    // Menggunakan properti 'total' dari data mock
    return currentYearStats.reduce((sum, month) => sum + month.total, 0); 
  }, [currentYearStats]);

  const rataRataKehadiranPerBulan = useMemo(() => {
      const activeMonths = currentYearStats.length; 
      if (activeMonths === 0) return 0;
      // Hitung rata-rata berdasarkan total kehadiran
      return Math.round(totalKehadiranTahunan / activeMonths);
  }, [currentYearStats, totalKehadiranTahunan]);
  
  // Data harian untuk Line Chart Bulanan (Ditambahkan jemaat ke dependency array)
  const dailyTrendsData = useMemo(() => {
      if (jemaat.length === 0) return []; 
      return generateMockDailyTrends(startMonth, year, currentMonthStats);
  }, [startMonth, year, currentMonthStats, jemaat, actualAttendanceDates]); // Tambahkan actualAttendanceDates

  // --- END MOCK LOGIC ---


  // Handler untuk Kalender Detail (Sekarang multi-select)
  const handleSelectDate = (day: number, month: number) => {
    const clickedDate = new Date(detailYear, month, day);
    const key = getDayKey(clickedDate);
    const isFuture = clickedDate.setHours(0, 0, 0, 0) > todayStart;

    if (isFuture) return;
    
    setSelectedDatesKeys(prevKeys => {
        if (prevKeys.includes(key)) {
            return prevKeys.filter(k => k !== key); // Deselect
        } else {
            return [...prevKeys, key].sort(); // Select and Sort
        }
    });
  };
  
  // Handlers NAVIGASI GLOBAL (Tampilan Bulanan/Tahunan)
  const handlePrevYear = () => {
    setYear(prev => prev - 1);
  }
  
  const handleNextYear = () => {
    if (year < currentYear) { // Batasi hanya sampai tahun saat ini
      setYear(prev => prev + 1);
    }
  }

  const handlePrevMonth = () => {
    if (startMonth === 0) {
      setStartMonth(11);
      setYear(year - 1);
    } else {
      setStartMonth(prev => prev - 1);
    }
  };
  
  // LOGIKA BARU: Batasi navigasi ke depan (Next Month)
  const handleNextMonth = () => {
    const nextDate = new Date(year, startMonth + 1, 1);
    
    // Periksa jika bulan berikutnya lebih besar dari bulan saat ini di tahun yang sama
    if (nextDate.getFullYear() > currentYear || 
        (nextDate.getFullYear() === currentYear && nextDate.getMonth() > currentMonth)) {
        // Tidak boleh maju ke masa depan
        return;
    }
    
    if (startMonth === 11) {
      setStartMonth(0);
      setYear(year + 1);
    } else {
      setStartMonth(prev => prev + 1);
    }
  };
  
  // Logika untuk menonaktifkan tombol Next Month
  const isNextMonthDisabled = useMemo(() => {
    // Navigasi tidak boleh melewati bulan saat ini
    return year > currentYear || (year === currentYear && startMonth >= currentMonth);
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
      setDetailStartMonth(prev => prev - 1);
    }
  };

  const handleDetailNextMonth = () => {
    if (detailStartMonth === 11) {
      setDetailStartMonth(0);
      setDetailYear(detailYear + 1);
    } else {
      setDetailStartMonth(prev => prev + 1);
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
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768; 
    const count = isMobile ? 1 : 3;
    
    // Tentukan bulan awal tampilan.
    const startMonthOffset = isMobile ? 0 : -1;

    for (let i = 0; i < count; i++) {
        const targetDate = new Date(detailYear, detailStartMonth + startMonthOffset + i, 1);
        const monthIndex = targetDate.getMonth();
        const year = targetDate.getFullYear();
        months.push({ monthIndex, year });
    }
    return months;
  }, [detailStartMonth, detailYear]);


  // Generate tahun untuk year picker
  const currentYearForGrid = new Date().getFullYear();
  const yearsForPicker = useMemo(() => {
    const startYear = gridStartYear;
    return Array.from({ length: 10 }, (_, i) => startYear + i);
  }, [gridStartYear]);
  
  // Konversi actualAttendanceDates ke Set untuk lookup yang efisien
  const actualAttendanceSet = useMemo(() => new Set(actualAttendanceDates), [actualAttendanceDates]); 

  // Tanggal yang memiliki statistik (yaitu, ada data kehadiran aktual)
  const getDatesWithStats = (month: number, year: number, actualAttendanceSet: Set<string>) => {
    const dates = new Set<string>();
    const daysInMonth = getDaysInMonth(month, year);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayKey = getDayKey(date);
      
      // Filter hanya hari yang ADA di data kehadiran yang sudah lewat
      if (actualAttendanceSet.has(dayKey) && date.getTime() <= todayStart) {
        dates.add(dayKey);
      }
    }
    return dates;
  };

  // Handler untuk LineChart Tahunan (Navigasi ke database bulan itu)
  const handleYearlyChartClick = (state: any) => {
    if (state?.activeLabel) {
      const monthName = state.activeLabel;
      const monthIndex = monthNames.findIndex(name => name.substring(0, 3) === monthName);
      
      if (monthIndex > -1) {
        // NAVIGASI DENGAN PARAMETER YANG JELAS: date=YYYY-MM
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`; 
        void router.push(`/database?date=${dateKey}&mode=monthly`);
      }
    }
  };
  
  // LOGIKA DOWNLOAD UTAMA PDF (DIUBAH UNTUK MENGATASI AUTO-TABLE ERROR)
  const handleDownload = async () => {
    try {
      const statElement = document.getElementById("statistic-content");
      if (!statElement) {
        alert("Elemen konten statistik tidak ditemukan.");
        return;
      }

      // Sembunyikan sidebar sementara agar tidak ikut ke capture
      const sidebar = document.querySelector(".fixed.top-0.left-0.h-screen") as HTMLElement;
      if (sidebar) sidebar.style.display = "none";
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
      cloned.querySelectorAll('button').forEach(btn => {
        if (btn.textContent?.includes('Download') || btn.textContent?.includes('Statistik')) {
          btn.style.display = 'none';
        }
      });
      // Sembunyikan juga tombol navigasi bulan/tahun
      cloned.querySelectorAll('.rounded-full.p-3').forEach(btn => btn.style.display = 'none');
      // Sembunyikan juga keterangan "Klik titik pada grafik"
      cloned.querySelectorAll('p').forEach(p => {
        if (p.textContent?.includes('Klik titik pada grafik')) {
            p.style.display = 'none';
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
      if (sidebar) sidebar.style.display = "";
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
        pdf.addImage(dataUrl, "JPEG", margin, margin - yOffset, availableWidth, scaledHeight);
        yOffset += (pageHeight - margin * 2); // Pindah halaman sesuai tinggi area cetak
        if (yOffset < scaledHeight) pdf.addPage();
      }

      pdf.save("Laporan-Statistik.pdf");
    } catch (error) {
      console.error("❌ Gagal membuat PDF:", error);
      alert("Gagal membuat PDF. Silakan coba lagi.");
    }
  };

  return (
    // FIX 1: Set outer container to h-screen to establish viewport height
    <div className="flex h-screen bg-gray-50"> 
      
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - FIX 2 & 3: Container fixed, h-screen, bg-white, and Sidebar component forced to fill height */}
      <div className={`fixed top-0 left-0 z-40 transition-transform duration-300 transform w-64 h-screen bg-white shadow-2xl lg:shadow-none lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* FIX 4: Pass style to force component content to fill container */}
        <Sidebar activeView='statistic' style={{ height: '100%' }} />
      </div>

      {/* Main Content - FIX 5: Use overflow-y-auto for scrolling content and ml-64 for desktop alignment */}
      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 lg:ml-64 overflow-y-auto`}> 
        
        {/* Hamburger Menu for Mobile */}
        <div className="lg:hidden flex justify-start mb-4">
            <button 
                id="mobile-menu-button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-full bg-indigo-600 text-white shadow-md"
            >
                <Menu size={24} />
            </button>
        </div>
      
        <div id="statistic-content" ref={contentRef}>
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Laporan dan Statistik Jemaat</h1>
              <button 
                  onClick={handleDownload} // Langsung panggil handleDownload
                  disabled={
                    isLoading || 
                    (viewMode === 'yearly' && selectedDatesKeys.length === 0 && currentYearStats.length === 0) ||
                    (viewMode === 'monthly' && selectedDatesKeys.length === 0 && currentMonthStats.total === 0)
                  }                
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg text-sm md:text-base"
              >
                  <Download size={18} />
                  <span className="hidden sm:inline">Download Laporan (PDF)</span> 
                  <span className="sm:hidden">Download</span>
              </button>
          </div>


          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 size={32} className="animate-spin text-indigo-600 mr-2" />
              <p className="text-xl text-indigo-600">Memuat data statistik...</p>
            </div>
          ) : (
            <>
              {/* Statistik Keseluruhan */}
              <section className="mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-indigo-700 mb-4 border-b pb-2 flex items-center">
                  <BarChart3 size={20} className="mr-2"/> Statistik Keseluruhan Database
                </h2>
                
                {/* Toggle View Mode */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <button
                    onClick={() => setViewMode('monthly')}
                    className={`flex-1 px-4 sm:px-8 py-3 rounded-xl font-bold text-sm sm:text-lg transition-all duration-200 shadow-md ${
                      viewMode === 'monthly' 
                        ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50 hover:border-indigo-400'
                    }`}
                  >
                    Tampilan Bulanan
                  </button>
                  <button
                    onClick={() => setViewMode('yearly')}
                    className={`flex-1 px-4 sm:px-8 py-3 rounded-xl font-bold text-sm sm:text-lg transition-all duration-200 shadow-md ${
                      viewMode === 'yearly' 
                        ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50 hover:border-indigo-400'
                    }`}
                  >
                    Tampilan Tahunan
                  </button>
                </div>

                {/* Navigasi Bulan/Tahun (Global) */}
                <div className="flex items-center justify-between mb-6 bg-white p-3 sm:p-5 rounded-xl shadow-md">
                  
                  {/* Navigasi Kiri (Tahun/Bulan) */}
                  {viewMode === 'yearly' ? (
                      <button 
                        onClick={handlePrevYear} 
                        className="rounded-full p-2 sm:p-3 text-indigo-600 hover:bg-indigo-100 transition"
                      >
                        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                  ) : (
                      <button 
                        onClick={handlePrevMonth} 
                        className="rounded-full p-2 sm:p-3 text-indigo-600 hover:bg-indigo-100 transition"
                      >
                        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                  )}
                  
                  <div className="relative">
                    {/* Tombol Tengah (Year Picker) */}
                    <button 
                      onClick={handleOpenYearPicker} // Panggil picker di kedua mode
                      className="text-lg sm:text-2xl font-bold text-gray-800 hover:text-indigo-600 transition px-3 sm:px-6 py-1 sm:py-2 rounded-lg hover:bg-indigo-50"
                    >
                      {viewMode === 'monthly' ? `${monthNames[startMonth]} ${year}` : `Tahun ${year}`}
                    </button>
                    
                    {/* MODAL YEAR PICKER GLOBAL */}
                    {showYearPicker && ( 
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-10 min-w-[300px] sm:min-w-[400px]">
                          <div className="flex items-center justify-between mb-4">
                              <button
                                  onClick={() => setGridStartYear(prev => prev - 10)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                              >
                                  <ChevronLeft className="h-5 w-5" />
                              </button>
                              <span className="text-lg font-semibold text-gray-700">
                                  {gridStartYear} - {gridStartYear + 9}
                              </span>
                              <button
                                  onClick={() => setGridStartYear(prev => prev + 10)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                              >
                                  <ChevronRight className="h-5 w-5" />
                              </button>
                          </div>
                        <div className="grid grid-cols-5 gap-3">
                          {yearsForPicker.map(y => (
                            <button
                              key={y}
                              onClick={() => handleYearChange(y)}
                              className={`px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition ${
                                y === year 
                                  ? 'bg-indigo-600 text-white shadow-lg' 
                                  : 'hover:bg-indigo-100 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {y}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setShowYearPicker(false)}
                            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                          >
                            Tutup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Navigasi Kanan (Tahun/Bulan) */}
                  {viewMode === 'yearly' ? (
                      <button 
                        onClick={handleNextYear} 
                        disabled={isNextYearDisabled} // Menonaktifkan tombol jika navigasi melewati tahun ini
                        className={`rounded-full p-2 sm:p-3 text-indigo-600 transition ${
                            isNextYearDisabled 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'hover:bg-indigo-100'
                        }`}
                      >
                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                  ) : (
                      <button 
                        onClick={handleNextMonth} 
                        disabled={isNextMonthDisabled} // Menonaktifkan tombol jika navigasi melewati bulan ini
                        className={`rounded-full p-2 sm:p-3 text-indigo-600 transition ${
                            isNextMonthDisabled 
                              ? 'text-gray-400 cursor-not-allowed' 
                            : 'hover:bg-indigo-100'
                        }`}
                      >
                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                  )}
                  
                </div>

                {/* Tampilan Bulanan */}
                {viewMode === 'monthly' && (
                  <>
                    {/* Summary Cards DENGAN TOTAL KEHADIRAN */}
                    <div className="mb-8">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        
                        {/* NEW: 0. Total Kehadiran */}
                         <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 sm:p-6 rounded-xl shadow-xl text-white">
                            <p className="text-xs sm:text-sm opacity-90 mb-1">Total Kehadiran</p>
                            <p className="text-3xl sm:text-4xl font-extrabold mt-1">{currentMonthStats.total}</p>
                            <p className="text-xs opacity-80 mt-1">akumulasi kehadiran per bulan</p>
                        </div>

                        {/* 1. Status Aktif */}
                        <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 sm:p-6 rounded-xl shadow-xl text-white">
                          <p className="text-xs sm:text-sm opacity-90 mb-1">Status Aktif</p>
                          <p className="text-3xl sm:text-4xl font-extrabold">{currentMonthStats.aktif}</p>
                          <p className="text-xs opacity-80 mt-1">jemaat per bulan</p>
                        </div>
                        
                        {/* 2. Status Jarang Hadir */}
                        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 sm:p-6 rounded-xl shadow-xl text-white">
                          <p className="text-xs sm:text-sm opacity-90 mb-1">Status Jarang Hadir</p>
                          <p className="text-3xl sm:text-4xl font-extrabold">{currentMonthStats.jarangHadirlah}</p>
                          <p className="text-xs opacity-80 mt-1">jemaat per bulan</p>
                        </div>
                        
                        {/* 3. Status Tidak Aktif */}
                        <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 sm:p-6 rounded-xl shadow-xl text-white">
                          <p className="text-xs sm:text-sm opacity-90 mb-1">Status Tidak Aktif</p>
                          <p className="text-3xl sm:text-4xl font-extrabold">{currentMonthStats.tidakAktif}</p>
                          <p className="text-xs opacity-80 mt-1">jemaat per bulan</p>
                        </div>
                      </div>

                      {/* Grafik Statistik Bulanan (DIUBAH) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Pie Chart: Distribusi Status Kehadiran Bulanan */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
                          <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
                            Distribusi Status Kehadiran Bulan {monthNames[startMonth]}
                          </h3>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie 
                                data={[
                                  { name: 'Aktif', value: currentMonthStats.aktif },
                                  { name: 'Jarang Hadir', value: currentMonthStats.jarangHadirlah },
                                  { name: 'Tidak Aktif', value: currentMonthStats.tidakAktif }
                                ]} 
                                cx="50%" 
                                cy="50%" 
                                labelLine={false} 
                                label={({ name, value }) => `${name}: ${value}`} 
                                outerRadius={90} 
                                fill="#8884d8" 
                                dataKey="value"
                              >
                                <Cell fill="#10B981" />
                                <Cell fill="#F59E0B" />
                                <Cell fill="#EF4444" />
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* MonthLineChart: Tren Status Kehadiran Per Tanggal (NEW) */}
                        <MonthLineChart data={dailyTrendsData} month={startMonth} year={year} />
                        
                      </div>
                    </div>
                  </>
                )}

                {/* Tampilan Tahunan - Diagram Garis (PERBAIKAN SINKRONISASI) */}
                {viewMode === 'yearly' && (
                  <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-xl border-2 border-gray-200">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">
                      Statistik Kehadiran Tahunan {year}
                    </h3>
                    
                    <ResponsiveContainer width="100%" height={450}>
                      <LineChart 
                        data={currentYearStats} 
                        margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                        onMouseDown={handleYearlyChartClick}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bulan" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="aktif" stroke="#10B981" strokeWidth={3} name="Aktif" dot={{ fill: '#10B981' }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="jarangHadirlah" stroke="#F59E0B" strokeWidth={3} name="Jarang Hadir" dot={{ fill: '#F59E0B' }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="tidakAktif" stroke="#EF4444" strokeWidth={3} name="Tidak Aktif" dot={{ fill: '#EF4444' }} activeDot={{ r: 8 }} />
                        {/* PERBAIKAN: dot={false} untuk Total Kehadiran */}
                        <Line 
                            type="monotone" 
                            dataKey="total" 
                            stroke="#4F46E5" 
                            strokeWidth={4} 
                            name="Total Kehadiran" 
                            dot={false} // PERBAIKAN: Menghilangkan titik
                            activeDot={false} // PERBAIKAN: Menghilangkan titik aktif
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* Summary Cards Tahunan (MENJADI 5 KARTU) */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mt-8">
                      {/* Kartu 1: Total Kehadiran Tahunan */}
                      <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4 sm:p-6 text-center">
                        <p className="text-xs sm:text-sm text-indigo-700 mb-2 font-semibold">Total Kehadiran Tahunan</p>
                        <p className="text-4xl sm:text-5xl font-extrabold text-indigo-600">
                          {totalKehadiranTahunan}
                        </p>
                        <p className="text-xs text-indigo-600 mt-2">akumulasi total kehadiran</p>
                      </div>

                      {/* Kartu 2: Total Status Aktif */}
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 sm:p-6 text-center">
                        <p className="text-xs sm:text-sm text-green-700 mb-2 font-semibold">Total Status Aktif</p>
                        <p className="text-4xl sm:text-5xl font-extrabold text-green-600">
                          {totalAktifTahunan}
                        </p>
                        <p className="text-xs text-green-600 mt-2">akumulasi status aktif</p>
                      </div>
                      
                      {/* Kartu 3: Total Status Jarang Hadir */}
                      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6 text-center">
                        <p className="text-xs sm:text-sm text-yellow-700 mb-2 font-semibold">Total Jarang Hadir</p>
                        <p className="text-4xl sm:text-5xl font-extrabold text-yellow-600">
                          {totalJarangHadirlahTahunan}
                        </p>
                        <p className="text-xs text-yellow-600 mt-2">akumulasi status jarang hadir</p>
                      </div>

                      {/* Kartu 4: Total Status Tidak Aktif */}
                      <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 sm:p-6 text-center">
                        <p className="text-xs sm:text-sm text-red-700 mb-2 font-semibold">Total Tidak Aktif</p>
                        <p className="text-4xl sm:text-5xl font-extrabold text-red-600">
                          {totalTidakAktifTahunan}
                        </p>
                        <p className="text-xs text-red-600 mt-2">akumulasi status tidak aktif</p>
                      </div>

                      {/* Kartu 5: Rata-Rata Kehadiran Per Bulan */}
                      <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4 sm:p-6 text-center">
                        <p className="text-xs sm:text-sm text-gray-700 mb-2 font-semibold">Rata-rata Kehadiran/Bulan</p>
                        <p className="text-4xl sm:text-5xl font-extrabold text-gray-600">
                          {rataRataKehadiranPerBulan}
                        </p>
                        <p className="text-xs text-gray-600 mt-2">orang per bulan</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Kalender - Pilih Tanggal untuk Detail Statistik (Sudah diperbaiki untuk Multi-Select) */}
              <section className="mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-indigo-700 mb-4 flex items-center">
                  <Calendar size={20} className="mr-2"/> Pilih Tanggal untuk Detail Statistik
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  <span className="inline-flex items-center">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                    Tanggal dengan titik biru adalah hari yang memiliki data kehadiran aktual.
                  </span>
                  <br/>
                  <span className="font-semibold text-red-600">
                    *Klik tanggal untuk menambah/menghapus dari seleksi. Statistik di bawah akan mengakumulasi semua tanggal yang dipilih.
                  </span>
                </p>
                
                {/* Navigasi Bulan/Tahun untuk Kalender Detail (Tampilan Tahun) */}
                <div className="flex items-center justify-between mb-6 bg-white p-3 sm:p-5 rounded-xl shadow-md">
                  <button 
                    onClick={handleDetailPrevMonth} 
                    className="rounded-full p-2 sm:p-3 text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  
                  <div className="relative">
                    {/* PERUBAHAN: Tampilkan hanya Tahun, dan klik akan membuka pemilih tahun */}
                    <button 
                      onClick={handleOpenDetailYearPicker}
                      className="text-lg sm:text-2xl font-bold text-gray-800 hover:text-indigo-600 transition px-3 sm:px-6 py-1 sm:py-2 rounded-lg hover:bg-indigo-50"
                    >
                      Tahun {detailYear}
                    </button>
                    
                    {/* MODAL YEAR PICKER DETAIL */}
                    {showDetailYearPicker && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-10 min-w-[300px] sm:min-w-[400px]">
                          <div className="flex items-center justify-between mb-4">
                              <button
                                  onClick={() => setGridStartYear(prev => prev - 10)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                              >
                                  <ChevronLeft className="h-5 w-5" />
                              </button>
                              <span className="text-lg font-semibold text-gray-700">
                                  {gridStartYear} - {gridStartYear + 9}
                              </span>
                              <button
                                  onClick={() => setGridStartYear(prev => prev + 10)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                              >
                                  <ChevronRight className="h-5 w-5" />
                              </button>
                          </div>
                        <div className="grid grid-cols-5 gap-3">
                          {yearsForPicker.map(y => (
                            <button
                              key={y}
                              onClick={() => handleDetailYearChange(y)}
                              className={`px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition ${
                                y === detailYear
                                  ? 'bg-indigo-600 text-white shadow-lg' 
                                  : 'hover:bg-indigo-100 text-gray-700 border border-gray-200'
                              }`}
                            >
                              {y}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-center mt-6">
                          <button
                            onClick={() => setShowDetailYearPicker(false)}
                            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                          >
                            Tutup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleDetailNextMonth} 
                    className="rounded-full p-2 sm:p-3 text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {monthsToDisplay.map(({ monthIndex, year }) => {
                    const daysInMonth = getDaysInMonth(monthIndex, year);
                    const firstDay = getFirstDayOfMonth(monthIndex, year);
                    const startDayOffset = firstDay === 0 ? 6 : firstDay - 1;
                    const daysArray = [
                      ...Array(startDayOffset).fill(null),
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                    ];
                    // OLD: const datesWithStats = getDatesWithStats(monthIndex, year);
                    const datesWithStats = getDatesWithStats(monthIndex, year, actualAttendanceSet); // Digunakan untuk DOT

                    
                    return (
                      <div key={`${year}-${monthIndex}`} className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-md hover:shadow-lg transition">
                        <h4 className="mb-4 text-center text-lg font-bold text-indigo-600">
                          {monthNames[monthIndex]} {year}
                        </h4>
                        <div className="grid grid-cols-7 text-xs font-semibold text-gray-500 mb-3">
                          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                            <div key={d} className="text-center">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
                          {daysArray.map((day, i) => {
                            if (day === null) return <div key={i} className="p-2"></div>;
                            const thisDate = new Date(year, monthIndex, day);
                            const dayKey = getDayKey(thisDate);
                            const isSelected = selectedDatesKeys.includes(dayKey);
                            const dateTimestamp = new Date(thisDate).setHours(0, 0, 0, 0);
                            const isFuture = dateTimestamp > todayStart;
                            
                            const hasStats = datesWithStats.has(dayKey);
                            
                            const handleClick = () => {
                              // MODIFIED: Izinkan klik untuk semua tanggal di masa lalu/sekarang
                              if (!isFuture) {
                                handleSelectDate(day, monthIndex);
                              }
                            };

                            return (
                              <div 
                                key={i} 
                                className={`relative p-2.5 rounded-lg transition-all duration-200 font-medium ${
                                  isSelected 
                                    ? 'bg-red-500 text-white font-bold shadow-lg scale-110 ring-2 ring-red-300 cursor-pointer' 
                                    : !isFuture
                                    ? 'text-gray-800 hover:bg-indigo-100 hover:scale-105 cursor-pointer' // Boleh diklik, warna normal
                                    : 'text-gray-300 cursor-not-allowed' // Tanggal masa depan
                                }`}
                                onClick={handleClick}
                              >
                                {day}
                                {/* Titik hanya muncul jika ada data (hasStats) DAN TIDAK terpilih */}
                                {hasStats && !isSelected && (
                                  <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
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
              {selectedDatesKeys.length > 0 && totalKehadiranSelectedDates > 0 ? (
                <section className="mt-8">
                  <div className="flex justify-between items-center border-b-2 pb-2 mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-red-600">
                      Detail Kehadiran: {selectedDatesKeys.length} Tanggal Dipilih ({selectedDatesDisplay})
                    </h2>
                  </div>
                  
                  {/* 1. Total Kehadiran Semua Ibadah (Satu Kartu Gabungan) */}
                  <div className="grid grid-cols-1 mb-6 max-w-lg mx-auto">
                      <div className="bg-red-100 p-6 rounded-xl shadow-md border-2 border-red-300">
                          <p className="text-sm text-red-700">Total Kehadiran Semua Kebaktian & Sesi Ibadah</p>
                          <p className="text-5xl font-extrabold text-red-600 mt-1">{totalKehadiranSelectedDates}</p>
                          <p className="text-xs text-red-500">Total akumulatif yang hadir di semua sesi dari {selectedDatesKeys.length} tanggal</p>
                      </div>
                  </div>

                  {/* 2. Total Kehadiran di Masing-Masing Kebaktian (Dynamic Cards Gabungan) */}
                  <div className="mb-8">
                      <h3 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Total Kehadiran per Sesi Kebaktian (Akumulatif)</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {Object.entries(combinedKehadiranBySesi).sort(([, a], [, b]) => b - a).map(([sessionName, count]) => {
                            const isHovered = hoveredSession === sessionName;
                            const cleanSessionName = getCleanSessionName(sessionName);
                            const highlight = isHovered; 

                            return (
                              <div 
                                key={sessionName} 
                                className={`p-4 rounded-xl shadow-md border transition-all duration-300 cursor-default
                                  ${highlight 
                                    ? 'bg-indigo-200 border-indigo-500 scale-105 shadow-lg' 
                                    : 'bg-white border-indigo-200'
                                  }
                                `}
                                onMouseEnter={() => setHoveredSession(sessionName)}
                                onMouseLeave={() => setHoveredSession(null)}
                              >
                                  <p className="text-sm text-indigo-700 font-semibold truncate" title={sessionName}>{cleanSessionName}</p>
                                  <p className="text-3xl font-extrabold text-gray-800 mt-1">{count}</p>
                                  <p className="text-xs text-gray-500">{sessionName.replace(cleanSessionName, '').trim() || 'orang hadir'}</p>
                              </div>
                            );
                          })}
                      </div>
                  </div>
                  
                  {/* 3. Menampilkan chart di bawah */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <div className="mt-8 pt-6 border-t border-gray-300">
                          <h3 className="text-xl font-bold text-indigo-700 mb-4">Rincian Per Tanggal</h3>
                          <div className="space-y-6">
                              {/* Filter hanya tanggal yang memiliki data di dateStatsMap */}
                              {selectedDatesKeys
                                  .filter(dateKey => dateStatsMap[dateKey])
                                  .map(dateKey => {
                                  
                                  const stats = dateStatsMap[dateKey];

                                  // Data untuk Pie Chart Kehadiran Sesi per Tanggal
                                  const singleDatePieData = Object.entries(stats.kehadiranBySesi).map(([name, value]) => ({ 
                                    name, 
                                    value, 
                                    fullSessionName: name 
                                  }));
                                  
                                  // Data untuk Line Chart Status Per Tanggal (Data Baru dari statusKehadiranBySesi)
                                  const singleDateStatusData = Object.entries(stats.statusKehadiranBySesi)
                                    .map(([session, statuses]) => ({
                                        session: getShortSessionName(session),
                                        fullSessionName: session,
                                        Aktif: statuses.Aktif || 0,
                                        'Jarang Hadir': statuses['Jarang Hadir'] || 0,
                                        'Tidak Aktif': statuses['Tidak Aktif'] || 0,
                                    }))
                                    .filter(item => item.Aktif > 0 || item['Jarang Hadir'] > 0 || item['Tidak Aktif'] > 0);


                                return (
                                <div key={dateKey} className="bg-white p-5 rounded-xl shadow-lg border-2 border-gray-100">
                                    <h4 className="text-lg font-bold text-indigo-600 mb-3">
                                        {new Date(dateKey).toLocaleDateString("id-ID", { weekday: 'long', day: "2-digit", month: "long", year: "numeric" })}
                                        {/* Tampilkan Total Hadir di Judul */}
                                        <span className="text-sm font-normal text-gray-500 ml-3">
                                            (Total Hadir: {stats.totalKehadiranSemuaSesi})
                                        </span>
                                    </h4>
                                    
                                    {/* Ringkasan Kartu Per Tanggal */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"> 
                                        <div className="p-3 bg-red-50 rounded-lg">
                                            <p className="text-sm text-red-700">Total Hadir</p>
                                            <p className="text-2xl font-bold text-red-600">{stats.totalKehadiranSemuaSesi}</p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg">
                                            <p className="text-sm text-green-700">Sesi Terbanyak</p>
                                            <p className="text-md font-semibold text-green-700 truncate" title={Object.entries(stats.kehadiranBySesi).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}>
                                                {getCleanSessionName(Object.entries(stats.kehadiranBySesi).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A')}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg">
                                            <p className="text-sm text-blue-700">Persentase</p>
                                            <p className="text-2xl font-bold text-blue-600">{stats.presentaseKehadiran}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Chart Detail Per Tanggal */}
                                    {singleDatePieData.length > 0 ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                                            {/* Line Chart Status Per Tanggal (Menggantikan Bar Chart) */}
                                            <SingleDateStatusLineChart data={singleDateStatusData} />

                                            {/* Pie Chart Sesi per Tanggal (Menggunakan PieChartCard yang sudah diperbaiki logic legend-nya) */}
                                            <div className="bg-white p-6 rounded-xl shadow-inner border border-gray-200">
                                                <h5 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
                                                    Persentase Kehadiran Sesi 
                                                </h5>
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <PieChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
                                                            {singleDatePieData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                          formatter={(value: unknown, name: string) => {
                                                            if (value === null || value === undefined) return ['Tidak Ada Data', name];
                                                            if (Array.isArray(value)) return [`${value.join(', ')} orang`, name];
                                                            return [`${String(value)} orang`, name];
                                                          }}
                                                        />
                                                        <Legend 
                                                            layout="horizontal" 
                                                            align="center" 
                                                            verticalAlign="bottom"
                                                            wrapperStyle={{ paddingTop: '0px', marginBottom: '-10px' }}
                                                            content={renderLegend} // Menggunakan custom render legend
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-gray-500 mt-4">Tidak ada data kehadiran untuk tanggal ini.</p>
                                    )}
                                </div>
                            );
                            })}
                        </div>
                    </div>
                )}
              </section>
            ) : (
                <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300">
                    <BarChart3 size={64} className="text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">Pilih minimal satu tanggal di kalender</p>
                    <p className="text-sm text-gray-400">Pilih hari untuk melihat detail statistik.</p>
                </div>
            )}
          </>
        )}
        
        {/* MODAL YEAR PICKER GLOBAL */}
        {showYearPicker && ( 
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm"> 
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                Pilih Tahun
              </h3>

              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setGridStartYear(prev => prev - 10)}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-lg font-semibold text-gray-700">
                  {gridStartYear} - {gridStartYear + 9}
                </span>
                <button
                  onClick={() => setGridStartYear(prev => prev + 10)}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {yearsForPicker.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg transition duration-150
                      ${y === year
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-600'
                      }
                    `}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowYearPicker(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]">
                <div className="bg-white p-6 rounded-xl shadow-2xl">
                    <div className="flex items-center gap-3">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                        <span className="text-lg font-semibold text-gray-800">Memproses download PDF...</span>
                    </div>
                </div>
            </div>
        )}
        {/* END LOADING DOWNLOAD */}
      </div>
      </main>
      
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