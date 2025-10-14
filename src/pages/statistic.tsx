import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { BarChart3, Calendar, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';

// --- Tipe Data ---
interface Jemaat {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  status: string; // Original database status
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif"; // Status kehadiran terhitung
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
}

// --- Konstanta Kalender ---
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();

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
const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#4F46E5', '#8B5CF6', '#EC4899'];

// Simulasi data statistik bulanan (Ini HARUS didasarkan pada data /api/jemaat yang sebenarnya di aplikasi nyata)
const monthlyStats = {
  "2025-10": { aktif: 45, jarangHadir: 15, tidakAktif: 10, totalIbadah: 4 },
  "2025-11": { aktif: 50, jarangHadir: 10, tidakAktif: 5, totalIbadah: 4 },
  "2025-12": { aktif: 48, jarangHadir: 12, tidakAktif: 6, totalIbadah: 5 },
  "2024-10": { aktif: 45, jarangHadir: 15, tidakAktif: 10, totalIbadah: 4 },
  "2024-11": { aktif: 50, jarangHadir: 10, tidakAktif: 5, totalIbadah: 4 },
  "2024-12": { aktif: 48, jarangHadir: 12, tidakAktif: 6, totalIbadah: 5 },
};

// Simulasi data statistik tahunan
const yearlyStats = {
  "2025": [
    { bulan: "Jan", aktif: 42, jarangHadir: 10, tidakAktif: 8 },
    { bulan: "Feb", aktif: 44, jarangHadir: 10, tidakAktif: 6 },
    { bulan: "Mar", aktif: 46, jarangHadir: 8, tidakAktif: 6 },
    { bulan: "Apr", aktif: 43, jarangHadir: 10, tidakAktif: 7 },
    { bulan: "Mei", aktif: 47, jarangHadir: 8, tidakAktif: 5 },
    { bulan: "Jun", aktif: 45, jarangHadir: 10, tidakAktif: 5 },
    { bulan: "Jul", aktif: 48, jarangHadir: 8, tidakAktif: 4 },
    { bulan: "Agu", aktif: 50, jarangHadir: 5, tidakAktif: 5 },
    { bulan: "Sep", aktif: 49, jarangHadir: 7, tidakAktif: 4 },
    { bulan: "Okt", aktif: 45, jarangHadir: 15, tidakAktif: 10 },
    { bulan: "Nov", aktif: 50, jarangHadir: 10, tidakAktif: 5 },
    { bulan: "Des", aktif: 48, jarangHadir: 12, tidakAktif: 6 },
  ],
  "2024": [
    { bulan: "Jan", aktif: 42, jarangHadir: 10, tidakAktif: 8 },
    { bulan: "Feb", aktif: 44, jarangHadir: 10, tidakAktif: 6 },
    { bulan: "Mar", aktif: 46, jarangHadir: 8, tidakAktif: 6 },
    { bulan: "Apr", aktif: 43, jarangHadir: 10, tidakAktif: 7 },
    { bulan: "Mei", aktif: 47, jarangHadir: 8, tidakAktif: 5 },
    { bulan: "Jun", aktif: 45, jarangHadir: 10, tidakAktif: 5 },
    { bulan: "Jul", aktif: 48, jarangHadir: 8, tidakAktif: 4 },
    { bulan: "Agu", aktif: 50, jarangHadir: 5, tidakAktif: 5 },
    { bulan: "Sep", aktif: 49, jarangHadir: 7, tidakAktif: 4 },
    { bulan: "Okt", aktif: 45, jarangHadir: 15, tidakAktif: 10 },
    { bulan: "Nov", aktif: 50, jarangHadir: 10, tidakAktif: 5 },
    { bulan: "Des", aktif: 48, jarangHadir: 12, tidakAktif: 6 },
  ]
};

// --- Logika Statistik ---
const calculateOverallStats = (jemaat: Jemaat[]) => {
  if (jemaat.length === 0) {
    return { totalJemaat: 0, aktif: 0, tidakAktif: 0, presentaseAktif: "0%", jabatanDistribution: {}, kehadiranDistribution: {} as Record<Jemaat['statusKehadiran'], number> };
  }
  
  const aktif = jemaat.filter(j => j.status === "Aktif").length;
  const tidakAktif = jemaat.length - aktif;
  const presentaseAktif = ((aktif / jemaat.length) * 100).toFixed(1) + "%";
  
  const jabatanDistribution = jemaat.reduce((acc, j) => {
    acc[j.jabatan] = (acc[j.jabatan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const kehadiranDistribution = jemaat.reduce((acc, j) => {
    acc[j.statusKehadiran] = (acc[j.statusKehadiran] || 0) + 1;
    return acc;
  }, {} as Record<Jemaat['statusKehadiran'], number>);

  return { totalJemaat: jemaat.length, aktif, tidakAktif, presentaseAktif, jabatanDistribution, kehadiranDistribution };
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
        .replace(": 07:00", "")
        .replace(": 10:00", "")
        .replace(": 17:00", "")
        .replace("Minggu, ", "")
        .replace("Sabtu, ", "")
        .trim();
};

// Fungsi untuk mendapatkan nama sesi yang bersih (hanya jenis ibadah/kebaktian)
const getCleanSessionName = (session: string) => {
    return session
        .replace(/ \:.*$/, '') // Hapus waktu
        .replace(/ ,.*$/, '') // Hapus hari (jika ada koma)
        .replace(/ (Minggu|Sabtu)/, '') // Hapus hari (jika tidak ada koma)
        .trim();
}

// Fungsi untuk menghitung distribusi status per sesi (untuk Line Chart Detail)
const calculateStatusBySession = (jemaat: Jemaat[]) => {
    const sessionData: Record<string, Record<string, number>> = {};

    jemaat.forEach(j => {
        const session = j.kehadiranSesi || 'Lainnya';
        const status = j.statusKehadiran;

        if (!sessionData[session]) {
            sessionData[session] = { Aktif: 0, 'Jarang Hadir': 0, 'Tidak Aktif': 0 };
        }
        sessionData[session][status] = (sessionData[session][status] || 0) + 1;
    });

    // Transformasi data untuk Recharts LineChart
    const chartData = Object.entries(sessionData)
        .map(([session, statuses]) => ({
            // MENGGUNAKAN LABEL YANG LEBIH PENDEK UNTUK GRAFIK
            session: getShortSessionName(session),
            fullSessionName: session, // Menyimpan nama lengkap untuk referensi
            Aktif: statuses.Aktif || 0,
            'Jarang Hadir': statuses['Jarang Hadir'] || 0,
            'Tidak Aktif': statuses['Tidak Aktif'] || 0,
        }))
        .filter(item => item.Aktif > 0 || item['Jarang Hadir'] > 0 || item['Tidak Aktif'] > 0);

    return chartData;
};


const calculateDateStats = (jemaat: Jemaat[], selectedDate: string) => {
  const totalJemaat = jemaat.length;
  
  // LOGIKA MOCK: Untuk simulasi di tanggal tertentu
  const dateObj = new Date(selectedDate);
  const dayOfWeek = dateObj.getDay(); // 0 = Minggu

  // Asumsi kehadiran lebih tinggi di hari Minggu
  const attendanceFactor = (dayOfWeek === 0) ? 0.85 : 0.60; 
  
  const mockHadir = Math.round(totalJemaat * attendanceFactor);
  const mockTidakHadir = totalJemaat - mockHadir;

  const totalHadir = mockHadir; 
  const totalTidakHadir = mockTidakHadir;
  const presentaseKehadiran = ((totalHadir / totalJemaat) * 100).toFixed(1) + "%";

  // Mock Kehadiran berdasarkan Sesi
  const kehadiranBySesi: Record<string, number> = {};
  const allSessions = [
    'Kebaktian I : 07:00', 'Kebaktian II : 10:00', 'Kebaktian III : 17:00', 
    'Ibadah Anak : Minggu, 10:00', 'Ibadah Remaja : Minggu, 10:00', 
    'Ibadah Pemuda : Minggu, 10:00', 'Ibadah Lansia : Sabtu, 10:00', 
    'Ibadah Dewasa : Sabtu, 17:00'
  ];

  let remainingHadir = totalHadir;
  
  // Simulasikan pembagian kehadiran, prioritaskan sesi di hari yang sesuai
  allSessions.forEach(session => {
    let mockCount = 0;
    const sessionDay = session.includes('Minggu') ? 0 : session.includes('Sabtu') ? 6 : -1;
    
    if (dayOfWeek === 0 && sessionDay === 0) {
      mockCount = Math.round(totalHadir * (Math.random() * 0.15 + 0.1)); // 10-25%
    } else if (dayOfWeek === 6 && sessionDay === 6) {
      mockCount = Math.round(totalHadir * (Math.random() * 0.15 + 0.05)); // 5-20%
    } else if (dayOfWeek !== 0 && dayOfWeek !== 6 && sessionDay === -1) {
      mockCount = Math.round(totalHadir * (Math.random() * 0.05)); // < 5% untuk non-layanan utama
    } else {
      mockCount = 0;
    }
    
    mockCount = Math.min(mockCount, remainingHadir);
    
    if (mockCount > 0) {
      kehadiranBySesi[session] = mockCount;
      remainingHadir -= mockCount;
    }
  });

  // Pastikan sisa kehadiran dialokasikan
  if (remainingHadir > 0 && dayOfWeek === 0 && kehadiranBySesi['Kebaktian I : 07:00']) {
      kehadiranBySesi['Kebaktian I : 07:00'] += remainingHadir;
  } else if (remainingHadir > 0) {
      // Jika tidak bisa dialokasikan, tambahkan ke sesi acak
      const randomSession = allSessions[Math.floor(Math.random() * allSessions.length)];
      kehadiranBySesi[randomSession] = (kehadiranBySesi[randomSession] || 0) + remainingHadir;
  }
  
  // Hitung TOTAL HADIR DARI SEMUA SESI
  const totalKehadiranSemuaSesi = Object.values(kehadiranBySesi).reduce((sum, count) => sum + count, 0);


  return { 
    totalHadir, 
    totalTidakHadir, 
    presentaseKehadiran, 
    kehadiranBySesi, 
    totalKehadiranSemuaSesi // Tambahkan hasil hitungan baru
  };
};

// Fungsi untuk simulasi data harian status kehadiran
const generateDailyStatusMock = (month: number, year: number, totalJemaat: number) => {
    const daysInMonth = getDaysInMonth(month, year);
    const dailyData = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay(); // 0 = Sunday
        const dayKey = getDayKey(date);

        // Hanya hari Minggu (0) yang memiliki statistik yang menonjol untuk simulasi
        const isSunday = dayOfWeek === 0;

        // Base values (total 200)
        let baseActive = Math.round(totalJemaat * 0.6); 
        let baseRare = Math.round(totalJemaat * 0.2);
        let baseInactive = totalJemaat - baseActive - baseRare;

        // Variasi harian
        let active = baseActive + Math.floor(Math.random() * 5) * (isSunday ? 5 : 1);
        let rare = baseRare - Math.floor(Math.random() * 3) * (isSunday ? 3 : 1);
        let inactive = baseInactive - Math.floor(Math.random() * 2) * (isSunday ? 2 : 1);
        
        // Pastikan nilai tidak negatif
        active = Math.max(0, active);
        rare = Math.max(0, rare);
        inactive = Math.max(0, inactive);
        
        // Normalisasi untuk total tetap
        const currentTotal = active + rare + inactive;
        if (currentTotal !== totalJemaat) {
          const diff = totalJemaat - currentTotal;
          if (diff > 0) { active += diff; }
        }

        dailyData.push({
            date: day.toString(),
            fullDateKey: dayKey, // Tambahkan fullDateKey
            Aktif: active,
            'Jarang Hadir': rare,
            'Tidak Aktif': inactive,
        });
    }
    return dailyData;
};


// --- Komponen Chart ---

// Komponen Line Chart untuk Tren Harian
const DailyLineChart = ({ data, month, year }: any) => {
  const router = useRouter();
  
  // Handler yang akan dipanggil saat titik pada LineChart diklik
  const handleChartClick = (state: any) => {
    if (state && state.activeLabel) {
      const day = state.activeLabel; // Tanggal (string) dari dataKey="date"
      const dateKey = getMonthKey(month, year) + '-' + String(day).padStart(2, '0');
      
      // Arahkan ke halaman database dengan query parameter tanggal
      router.push(`/database?date=${dateKey}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
        Tren Status Kehadiran Per Tanggal
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Tren harian status Aktif, Jarang Hadir, dan Tidak Aktif dalam bulan {monthNames[month]} {year}.
        <br/>
        <span className="font-semibold text-indigo-600">Klik titik pada grafik untuk melihat data tabel di hari tersebut!</span>
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart 
          data={data}
          onMouseDown={handleChartClick} // Menambahkan event handler untuk klik pada chart
          style={{ cursor: 'pointer' }} // Memberikan indikator kursor
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" label={{ value: 'Tanggal', position: 'insideBottom', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Aktif" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          <Line type="monotone" dataKey="Jarang Hadir" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
          <Line type="monotone" dataKey="Tidak Aktif" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};


// Komponen Line Chart untuk Tren Kehadiran per Sesi (Detail Tanggal)
const SessionLineChart = ({ data, hoveredSession, setHoveredSession, selectedDateKey }: any) => {
  const router = useRouter();

  // Handler untuk mengarahkan ke database dengan filter Tanggal + Sesi
  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const sessionName = state.activePayload[0].payload.fullSessionName;
      
      // Navigasi dengan 2 parameter: Tanggal dan Event (Sesi)
      router.push(`/database?date=${selectedDateKey}&event=${encodeURIComponent(sessionName)}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
            Tren Status Kehadiran per Sesi Kebaktian
        </h3>
        <p className="text-sm text-gray-500 mb-4">
            <span className="font-semibold text-indigo-600">Klik titik pada grafik untuk melihat detail tabel di Database!</span>
        </p>
        <ResponsiveContainer width="100%" height={280}>
            <LineChart 
                data={data} 
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                onMouseDown={handleChartClick} // Tambahkan klik handler
                style={{ cursor: 'pointer' }}
                onMouseEnter={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
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
                  type="monotone" 
                  dataKey="Aktif" 
                  stroke="#10B981" 
                  strokeWidth={2} 
                  name="Aktif" 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 8 }} 
                  opacity={hoveredSession === null || data.some((d: any) => d.fullSessionName === hoveredSession) ? 1 : 0.5}
                />
                <Line 
                  type="monotone" 
                  dataKey="Jarang Hadir" 
                  stroke="#F59E0B" 
                  strokeWidth={2} 
                  name="Jarang Hadir" 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 8 }} 
                  opacity={hoveredSession === null || data.some((d: any) => d.fullSessionName === hoveredSession) ? 1 : 0.5}
                />
                <Line 
                  type="monotone" 
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

// Komponen Pie Chart
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
        <PieChart>
          <Pie 
            data={chartData} 
            cx="50%" 
            cy="50%" 
            labelLine={false} 
            label={({ name, value }) => `${name}: ${value}`} 
            outerRadius={90} 
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
          <Tooltip />
          <Legend />
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
  // --- Start Month/Year untuk Tampilan Detail Statistik ---
  const [detailYear, setDetailYear] = useState(currentYear);
  const [detailStartMonth, setDetailStartMonth] = useState(currentMonth);
  // --- End Start Month/Year
  const [year, setYear] = useState(currentYear); // Year untuk Navigasi Bulanan Global/Tahunan
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null); 
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showDetailYearPicker, setShowDetailYearPicker] = useState(false); // BARU: Untuk Kalender Detail
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  
  // Mengambil data dari /api/jemaat
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat");
        if (!res.ok) throw new Error("Gagal fetch data jemaat");

        const data: unknown = await res.json();
        
        if (Array.isArray(data) && data.length > 0 && typeof (data[0] as Jemaat).statusKehadiran === 'string') {
          setJemaat(data as Jemaat[]);
        } else {
          throw new Error("Data jemaat tidak valid");
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  const overallStats = useMemo(() => calculateOverallStats(jemaat), [jemaat]);
  
  // Memproses data untuk Line Chart Status per Sesi Kebaktian
  const statusBySessionData = useMemo(() => calculateStatusBySession(jemaat), [jemaat]);
  
  const currentMonthStats = useMemo(() => {
    const monthKey = getMonthKey(startMonth, year);
    const stats = monthlyStats[monthKey as keyof typeof monthlyStats] || { aktif: 0, jarangHadir: 0, tidakAktif: 0, totalIbadah: 0 };
    return stats;
  }, [year, startMonth]);
  
  const currentYearStats = useMemo(() => {
    const stats = yearlyStats[year.toString() as keyof typeof yearlyStats] || [];
    return stats; 
  }, [year]);

  // Data tren harian
  const dailyStatusTrend = useMemo(() => {
    const totalJemaat = overallStats.totalJemaat || 200;
    // Menggunakan detailStartMonth/detailYear untuk tren harian
    return generateDailyStatusMock(detailStartMonth, detailYear, totalJemaat);
  }, [detailStartMonth, detailYear, overallStats.totalJemaat]);
  
  const dateStats = useMemo(() => {
    if (!selectedDateKey) return null;
    return calculateDateStats(jemaat, selectedDateKey);
  }, [jemaat, selectedDateKey]);

  // Handler untuk Kalender Detail
  const handleSelectDate = (day: number, month: number) => {
    const clickedDate = new Date(detailYear, month, day);
    const key = getDayKey(clickedDate);
    
    setSelectedDateKey(prevKey => prevKey === key ? null : key);
  };
  
  // Handlers NAVIGASI GLOBAL (Tampilan Bulanan/Tahunan)
  const handlePrevMonth = () => {
    if (startMonth === 0) {
      setStartMonth(11);
      setYear(year - 1);
    } else {
      setStartMonth(prev => prev - 1);
    }
  };
  
  const handleNextMonth = () => {
    if (startMonth === 11) {
      setStartMonth(0);
      setYear(year + 1);
    } else {
      setStartMonth(prev => prev + 1);
    }
  };
  
  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setShowYearPicker(false);
  };
  
  // Handlers NAVIGASI DETAIL KALENDER (Kalender di Poin 4)
  const handleDetailPrevMonth = () => {
    setSelectedDateKey(null); // Reset seleksi tanggal
    if (detailStartMonth === 0) {
      setDetailStartMonth(11);
      setDetailYear(detailYear - 1);
    } else {
      setDetailStartMonth(prev => prev - 1);
    }
  };

  const handleDetailNextMonth = () => {
    setSelectedDateKey(null); // Reset seleksi tanggal
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
    setSelectedDateKey(null); // Reset seleksi
  };


  const monthsToDisplay = useMemo(() => {
    const months = [];
    for (let i = 0; i < 3; i++) {
      const monthIndex = (detailStartMonth + i) % 12;
      months.push(monthIndex);
    }
    return months;
  }, [detailStartMonth]);

  const selectedDateDisplay = selectedDateKey 
    ? new Date(selectedDateKey).toLocaleDateString("id-ID", { weekday: 'long', day: "2-digit", month: "long", year: "numeric" })
    : "N/A";

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  
  const getDatesWithStats = (month: number, year: number) => {
    const dates = new Set<string>();
    const daysInMonth = getDaysInMonth(month, year);
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date.getDay() === 0 && date.getTime() <= today.getTime()) {
        dates.add(getDayKey(date));
      }
    }
    return dates;
  };

  // Handler untuk LineChart Tahunan
  const handleYearlyChartClick = (state: any) => {
    if (state && state.activeLabel) {
      const monthName = state.activeLabel;
      // Perlu mencari bulan dari 'Jan', 'Feb', dst.
      const monthIndex = monthNames.findIndex(name => name.substring(0, 3) === monthName);
      
      if (monthIndex > -1) {
        const dateKey = getMonthKey(monthIndex, year) + '-01'; // Ambil tanggal 1 bulan itu
        router.push(`/database?date=${dateKey}`);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full">
              <Sidebar activeView='statistic' />
            </div>

      {/* Main Content */}
      <main className="ml-64 flex-grow p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Laporan dan Statistik Jemaat</h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-xl text-indigo-600">Memuat data statistik...</p>
          </div>
        ) : (
          <>
            {/* Statistik Keseluruhan */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2 flex items-center">
                <BarChart3 size={20} className="mr-2"/> Statistik Keseluruhan Database
              </h2>
              
              {/* Overall Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-xl text-white">
                  <p className="text-sm opacity-80">Total Status Kehadiran Aktif</p>
                  <p className="text-4xl font-extrabold mt-1">{overallStats.kehadiranDistribution["Aktif"] ?? 0}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-xl shadow-xl text-white">
                  <p className="text-sm opacity-80">Total Status Kehadiran Jarang Hadir</p>
                  <p className="text-4xl font-extrabold mt-1">{overallStats.kehadiranDistribution["Jarang Hadir"] ?? 0}</p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl shadow-xl text-white">
                  <p className="text-sm opacity-80">Total Status Kehadiran Tidak Aktif</p>
                  <p className="text-4xl font-extrabold mt-1">{overallStats.kehadiranDistribution["Tidak Aktif"] ?? 0}</p>
                </div>
                 <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-xl shadow-xl text-white">
                  <p className="text-sm opacity-80">Total Jemaat Terdaftar</p>
                  <p className="text-4xl font-extrabold mt-1">{overallStats.totalJemaat}</p>
                </div>
              </div>

              {/* Toggle View Mode */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 shadow-md ${
                    viewMode === 'monthly' 
                      ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50 hover:border-indigo-400'
                  }`}
                >
                  Tampilan Bulanan
                </button>
                <button
                  onClick={() => setViewMode('yearly')}
                  className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 shadow-md ${
                    viewMode === 'yearly' 
                      ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-gray-50 hover:border-indigo-400'
                  }`}
                >
                  Tampilan Tahunan
                </button>
              </div>

              {/* Navigasi Bulan/Tahun (Global) */}
              <div className="flex items-center justify-between mb-6 bg-white p-5 rounded-xl shadow-md">
                <button 
                  onClick={handlePrevMonth} 
                  className="rounded-full p-3 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowYearPicker(!showYearPicker)}
                    className="text-2xl font-bold text-gray-800 hover:text-indigo-600 transition px-6 py-2 rounded-lg hover:bg-indigo-50"
                  >
                    {viewMode === 'monthly' ? `${monthNames[startMonth]} ${year}` : `Tahun ${year}`}
                  </button>
                  
                  {showYearPicker && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-10 min-w-[400px]">
                      <div className="grid grid-cols-5 gap-3">
                        {years.map(y => (
                          <button
                            key={y}
                            onClick={() => handleYearChange(y)}
                            className={`px-5 py-3 rounded-lg font-semibold text-base transition ${
                              y === year 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'hover:bg-indigo-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleNextMonth} 
                  className="rounded-full p-3 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>

              {/* Tampilan Bulanan */}
              {viewMode === 'monthly' && (
                <>
                  {/* Summary Cards */}
                  <div className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      
                      {/* 1. Status Aktif */}
                      <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-xl text-white">
                        <p className="text-sm opacity-90 mb-1">Status Aktif</p>
                        <p className="text-5xl font-extrabold">{currentMonthStats.aktif}</p>
                        <p className="text-xs opacity-80 mt-1">orang hadir terus</p>
                      </div>
                      
                      {/* 2. Status Jarang Hadir */}
                      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-xl shadow-xl text-white">
                        <p className="text-sm opacity-90 mb-1">Status Jarang Hadir</p>
                        <p className="text-5xl font-extrabold">{currentMonthStats.jarangHadir}</p>
                        <p className="text-xs opacity-80 mt-1">orang hadir maks 2x</p>
                      </div>
                      
                      {/* 3. Status Tidak Aktif */}
                      <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-xl shadow-xl text-white">
                        <p className="text-sm opacity-90 mb-1">Status Tidak Aktif</p>
                        <p className="text-5xl font-extrabold">{currentMonthStats.tidakAktif}</p>
                        <p className="text-xs opacity-80 mt-1">orang tidak hadir/hadir 1x</p>
                      </div>
                    </div>

                    {/* Grafik Statistik Bulanan */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">
                          Distribusi Status Kehadiran Bulan {monthNames[startMonth]}
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie 
                              data={[
                                { name: 'Aktif', value: currentMonthStats.aktif },
                                { name: 'Jarang Hadir', value: currentMonthStats.jarangHadir },
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

                      {/* Tren Harian Status Kehadiran (Line Chart) */}
                      <DailyLineChart 
                          data={dailyStatusTrend} 
                          month={detailStartMonth} 
                          year={detailYear} 
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Tampilan Tahunan - Diagram Garis */}
              {viewMode === 'yearly' && (
                <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-gray-200">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">
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
                      <Line type="monotone" dataKey="jarangHadir" stroke="#F59E0B" strokeWidth={3} name="Jarang Hadir" dot={{ fill: '#F59E0B' }} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="tidakAktif" stroke="#EF4444" strokeWidth={3} name="Tidak Aktif" dot={{ fill: '#EF4444' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  
                  {/* Summary Cards Tahunan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
                    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
                      <p className="text-sm text-green-700 mb-2 font-semibold">Total Status Aktif</p>
                      <p className="text-5xl font-extrabold text-green-600">
                        {currentYearStats.reduce((sum, month) => sum + month.aktif, 0)}
                      </p>
                      <p className="text-xs text-green-600 mt-2">akumulasi status aktif</p>
                    </div>
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center">
                      <p className="text-sm text-red-700 mb-2 font-semibold">Total Status Tidak Aktif</p>
                      <p className="text-5xl font-extrabold text-red-600">
                        {currentYearStats.reduce((sum, month) => sum + month.tidakAktif, 0)}
                      </p>
                      <p className="text-xs text-red-600 mt-2">akumulasi status tidak aktif</p>
                    </div>
                    <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-6 text-center">
                      <p className="text-sm text-indigo-700 mb-2 font-semibold">Rata-rata Aktif/Bulan</p>
                      <p className="text-5xl font-extrabold text-indigo-600">
                        {currentYearStats.length > 0 
                          ? Math.round(currentYearStats.reduce((sum, month) => sum + month.aktif, 0) / currentYearStats.length)
                          : 0
                        }
                      </p>
                      <p className="text-xs text-indigo-600 mt-2">orang per bulan</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Kalender - Pilih Tanggal untuk Detail Statistik (Sudah diperbaiki) */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center">
                <Calendar size={20} className="mr-2"/> Pilih Tanggal untuk Detail Statistik
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  Tanggal dengan titik biru memiliki data statistik.
                </span>
                <br/>
                <span className="font-semibold text-red-600">
                  *Klik tanggal bertitik biru untuk melihat detail statistik di bawah. Klik titik di grafik "Tren Harian" di atas untuk ke Database.
                </span>
              </p>
              
              {/* Navigasi Bulan/Tahun untuk Kalender Detail (BARU) */}
              <div className="flex items-center justify-between mb-6 bg-white p-5 rounded-xl shadow-md">
                <button 
                  onClick={handleDetailPrevMonth} 
                  className="rounded-full p-3 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                
                <div className="relative">
                  <button 
                    onClick={() => setShowDetailYearPicker(!showDetailYearPicker)}
                    className="text-2xl font-bold text-gray-800 hover:text-indigo-600 transition px-6 py-2 rounded-lg hover:bg-indigo-50"
                  >
                    {monthNames[detailStartMonth]} {detailYear}
                  </button>
                  
                  {showDetailYearPicker && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-10 min-w-[400px]">
                      <div className="grid grid-cols-5 gap-3">
                        {years.map(y => (
                          <button
                            key={y}
                            onClick={() => handleDetailYearChange(y)}
                            className={`px-5 py-3 rounded-lg font-semibold text-base transition ${
                              y === detailYear 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'hover:bg-indigo-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleDetailNextMonth} 
                  className="rounded-full p-3 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {monthsToDisplay.map((monthIndex) => {
                  const daysInMonth = getDaysInMonth(monthIndex, detailYear);
                  const firstDay = getFirstDayOfMonth(monthIndex, detailYear);
                  const startDayOffset = firstDay === 0 ? 6 : firstDay - 1;
                  const daysArray = [
                    ...Array(startDayOffset).fill(null),
                    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                  ];
                  const datesWithStats = getDatesWithStats(monthIndex, detailYear);
                  
                  return (
                    <div key={`${detailYear}-${monthIndex}`} className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-md hover:shadow-lg transition">
                      <h4 className="mb-4 text-center text-lg font-bold text-indigo-600">
                        {monthNames[monthIndex]} {detailYear}
                      </h4>
                      <div className="grid grid-cols-7 text-xs font-semibold text-gray-500 mb-3">
                        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                          <div key={d} className="text-center py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
                        {daysArray.map((day, i) => {
                          if (day === null) return <div key={i} className="p-2"></div>;
                          const thisDate = new Date(detailYear, monthIndex, day);
                          const dayKey = getDayKey(thisDate);
                          const isSelected = selectedDateKey === dayKey;
                          const hasStats = datesWithStats.has(dayKey);
                          
                          const handleClick = () => {
                            if (hasStats) {
                              handleSelectDate(day, monthIndex);
                            }
                          };

                          return (
                            <div 
                              key={i} 
                              className={`relative p-2.5 rounded-lg transition-all duration-200 font-medium ${
                                isSelected 
                                  ? 'bg-red-500 text-white font-bold shadow-lg scale-110 cursor-pointer' 
                                  : hasStats
                                  ? 'text-gray-800 hover:bg-indigo-100 hover:scale-105 cursor-pointer'
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                              onClick={handleClick}
                            >
                              {day}
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

            {/* Grafik Detail Tanggal (Sekarang akan muncul lagi saat tanggal diklik) */}
            {selectedDateKey && dateStats ? (
              <section className="mt-8">
                <h2 className="text-2xl font-bold text-red-600 mb-4 border-b-2 pb-2">
                  Detail Kehadiran: {selectedDateDisplay}
                </h2>
                
                {/* 1. Total Kehadiran Semua Ibadah (Satu Kartu) */}
                <div className="grid grid-cols-1 mb-6 max-w-lg mx-auto">
                    <div className="bg-red-100 p-6 rounded-xl shadow-md border-2 border-red-300">
                        <p className="text-sm text-red-700">Total Kehadiran Semua Kebaktian & Sesi Ibadah</p>
                        <p className="text-5xl font-extrabold text-red-600 mt-1">{dateStats.totalKehadiranSemuaSesi}</p>
                        <p className="text-xs text-red-500">Total akumulatif yang hadir di semua sesi</p>
                    </div>
                </div>

                {/* 2. Total Kehadiran di Masing-Masing Kebaktian (Dynamic Cards) */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Total Kehadiran per Sesi Kebaktian</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {Object.entries(dateStats.kehadiranBySesi).map(([sessionName, count]) => {
                          const isHovered = hoveredSession === sessionName;
                          
                          // Mendapatkan nama sesi yang bersih (hanya jenis ibadah/kebaktian)
                          const cleanSessionName = getCleanSessionName(sessionName);
                          
                          const highlight = isHovered; // Highlight berdasarkan hover pada kartu itu sendiri atau PieChart

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
                                <p className="text-sm text-indigo-700 font-semibold truncate" title={sessionName}>{cleanSessionName}</p> {/* <-- Judul Sesi Bersih */}
                                <p className="text-3xl font-extrabold text-gray-800 mt-1">{count}</p>
                                <p className="text-xs text-gray-500">{sessionName.replace(cleanSessionName, '').trim() || 'orang hadir'}</p> {/* <-- Info Waktu/Hari di Bawah */}
                            </div>
                          );
                        })}
                    </div>
                </div>
                
                {/* 3. Menampilkan chart di bawah (Diposisikan di luar grid cards di atas) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CHART 1: LINE CHART - Status Trend Per Session */}
                  <SessionLineChart
                    data={statusBySessionData}
                    hoveredSession={hoveredSession}
                    setHoveredSession={setHoveredSession}
                    selectedDateKey={selectedDateKey} // Berikan tanggal yang dipilih
                  />
                  {/* CHART 2: Distribusi Kehadiran Sesi (Pie Chart) */}
                  <PieChartCard 
                    title="Distribusi Kehadiran Berdasarkan Sesi" 
                    data={dateStats.kehadiranBySesi}
                    description="Jumlah kehadiran per sesi ibadah pada tanggal ini."
                    hoveredSession={hoveredSession}
                    setHoveredSession={setHoveredSession}
                  />
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
