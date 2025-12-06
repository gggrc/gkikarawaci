// src/pages/databaseUser.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
// Hapus import Pencil, Settings, X dari lucide-react (hanya untuk edit/manage)
import { Download, ChevronLeft, ChevronRight, BarChart3, Calendar, Eye, Menu, Loader2, X } from "lucide-react"; 
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';
import { jsPDF } from 'jspdf';
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
// Import tipe data yang lebih lengkap dari API route
import { type JemaatClient, type StatusKehadiran, type JemaatWithAttendanceInfo } from "~/app/api/jemaat/route"; 

// --- Tipe Data Weekly Event (DITAMBAHKAN) ---
interface WeeklyEvent {
  id: string; // ID unik dari event berkala
  title: string; // Nama event yang ditampilkan
  day_of_week: number; // Hari (0=Minggu, 1=Senin, dst)
  start_date: string; // Tanggal mulai (YYYY-MM-DD)
  end_date: string | null; // Tanggal selesai (YYYY-MM-DD) atau null jika selamanya
  repetition_type: 'Once' | 'Weekly' | 'Monthly';
  jenis_kebaktian: string;
  sesi_ibadah: number;
  Ibadah?: { tanggal_ibadah: string }[]; // Tambahkan properti Ibadah sesuai penggunaan
}

// List Jemaat Unik (untuk status overall, edit form, dan draft)
interface UniqueJemaat extends JemaatClient {
  id: string; // id_jemaat
}

// Baris Data Kehadiran (untuk tabel dan detail drawer - Attendance Instance)
interface JemaatRow extends JemaatWithAttendanceInfo {
  id: string; // id_jemaat-tanggal (ID unik per record kehadiran)
  // Semua properti dari JemaatClient juga ada di sini
}

// Tipe Response dari API (Disesuaikan dari database.tsx)
interface JemaatAPIResponse {
    jemaatData?: UniqueJemaat[]; 
    attendanceDates: string[];
    fullAttendanceRecords?: JemaatRow[];
    error?: string; 
}


type ViewMode = 'event_per_table' | 'monthly_summary';
type SelectedEventsByDate = Record<string, string[]>;
type EventsCache = Record<string, string[]>;

// --- UTILITY FUNCTIONS & CONSTANTS (Adapted from database.tsx) ---

const calculateAge = (dobString: string | undefined): string => {
  if (!dobString) return "";
  const today = new Date();
  const birthDate = new Date(dobString);
  
  if (isNaN(birthDate.getTime())) return "";

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
};

const monthNames: string[] = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", 
  "Agustus", "September", "Oktober", "November", "Desember",
];

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

const getDaysInMonth = (month: number, year: number): number => 
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (month: number, year: number): number => 
  new Date(year, month, 1).getDay();

/**
 * Fungsi ini sekarang mengambil SESI UNIK (jenis_kebaktian) dari data kehadiran 
 * yang sudah diambil dari backend.
 */
const getAvailableSessionNames = (allUniqueSessions: Set<string>): string[] => {
    // Mengembalikan semua sesi unik yang ada di data kehadiran (yang sudah disinkronkan dengan jenis_kebaktian)
    const sessions = [...allUniqueSessions].filter(s => s && s.trim() !== "");
    return sessions.sort();
};

/**
 * Memastikan event 'KESELURUHAN DATA HARI INI' selalu ada 
 * dan event dihasilkan berdasarkan sesi unik yang ada di database.
 */
const populateEventsForDate = (dateKey: string, date: Date, allUniqueSessions: Set<string>): string[] => {
    // Ambil semua sesi unik yang ada di database (kehadiranSesi)
    const defaultEventsFromDatabase = getAvailableSessionNames(allUniqueSessions);
    const combinedEvents = [...defaultEventsFromDatabase];
    
    // Sort dan filter duplikat
    const uniqueEvents = [...new Set(combinedEvents)].filter(e => e.trim() !== "" && e !== "KESELURUHAN DATA HARI INI");

    // Memastikan "KESELURUHAN DATA HARI INI" selalu ada di awal
    const finalEvents = [
        "KESELURUHAN DATA HARI INI", 
        ...uniqueEvents.sort()
    ].filter((v, i, a) => a.indexOf(v) === i && v.trim() !== ""); 
    
    // Kembalikan event yang ada (minimal event keseluruhan)
    return finalEvents.length > 0 ? finalEvents : ["KESELURUHAN DATA HARI INI"];
};

// **Logika Integrasi Event Berkala (Caching)**
const integrateWeeklyEvents = (
  weeklyEvents: WeeklyEvent[], 
  existingEvents: EventsCache, 
  allUniqueSessions: Set<string>
): EventsCache => {
    const updatedEvents = { ...existingEvents };

    for (const event of weeklyEvents) {
        const eventName = event.title;
        const lowerEventName = eventName.toLowerCase();

        // Loop lewat semua tanggal Ibadah yang dikembalikan dari API
        for (const ibadah of event.Ibadah ?? []) {
            const ibadahDate = new Date(ibadah.tanggal_ibadah);
            const dayKey = getDayKey(ibadahDate);

            // Gunakan `populateEventsForDate` untuk mendapatkan list awal (termasuk sesi unik dari data kehadiran)
            const initialEvents = updatedEvents[dayKey] ?? populateEventsForDate(dayKey, ibadahDate, allUniqueSessions);
            const eventExists = initialEvents.some(e => e.toLowerCase() === lowerEventName);

            if (!eventExists) {
                updatedEvents[dayKey] = [
                    "KESELURUHAN DATA HARI INI",
                    ...initialEvents.filter(e => e !== "KESELURUHAN DATA HARI INI"),
                    eventName
                ].filter((v, i, a) => a.indexOf(v) === i);
            } else {
                // perbaiki capitalization
                updatedEvents[dayKey] = initialEvents.map(e =>
                    e.toLowerCase() === lowerEventName ? eventName : e
                );
            }
        }
    }

    return updatedEvents;
};


const getDatesWithEventsInMonth = (
  month: number, 
  currentYear: number, 
  currentEvents: EventsCache,
  actualAttendanceDates: string[] 
): { date: Date, key: string, events: string[] }[] => {
  const daysInMonth = getDaysInMonth(month, currentYear);
  const dates: { date: Date, key: string, events: string[] }[] = [];
  const attendanceSet = new Set(actualAttendanceDates);
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, month, day);
    const dayKey = getDayKey(date);
    
    // HANYA proses tanggal yang sudah lewat atau hari ini (Batasan untuk tampil di Monthly Summary)
    if (new Date(date).setHours(0, 0, 0, 0) <= todayStart) { 
        
      const currentEventList = currentEvents[dayKey] ?? []; 
      
      // Jika ada event di cache ATAU ada data kehadiran aktual, masukkan ke list
      // Note: Logic ini hanya untuk Monthly Summary (yang harus di masa lalu/sekarang)
      if (currentEventList.length > 0 || attendanceSet.has(dayKey)) {
        dates.push({ date, key: dayKey, events: currentEventList });
      }
    }
  }
  return dates; 
};


// --- Helper untuk in-memory storage ---
const memoryStorage: { 
  selectedDates: string[], 
  selectedEventsByDate: SelectedEventsByDate, 
  events: EventsCache
} = {
  selectedDates: [],
  selectedEventsByDate: {},
  events: {}
};

const loadSelection = () => {
  const rawDates = memoryStorage.selectedDates;
  const dates = rawDates
    .map((d: string) => new Date(d))
    .filter((date: Date) => !isNaN(date.getTime()));
  
  const events = memoryStorage.selectedEventsByDate;
  return { dates, events };
};

const saveSelection = (dates: Date[], events: SelectedEventsByDate) => {
  const datesToStore = dates.map(getDayKey); 
  memoryStorage.selectedDates = datesToStore;
  memoryStorage.selectedEventsByDate = events;
};


// --- LOGIKA KALENDER (FROM database.tsx) ---
interface CalendarSectionProps {
    year: number;
    setYear: React.Dispatch<React.SetStateAction<number>>;
    startMonth: number;
    setStartMonth: React.Dispatch<React.SetStateAction<number>>;
    viewMode: ViewMode;
    handleSelectMonth: (monthIndex: number, currentYear: number, forceMonthlySummary?: boolean) => void;
    handleSelectDate: (day: number, month: number) => void;
    selectedDates: Date[];
    setShowYearDialog: React.Dispatch<React.SetStateAction<boolean>>;
    actualAttendanceDates: string[]; 
}

const CalendarSection = ({
    year, setYear, startMonth, setStartMonth, viewMode, 
    handleSelectMonth, handleSelectDate, selectedDates, setShowYearDialog,
    actualAttendanceDates 
}: CalendarSectionProps) => {

    const [isMobileView, setIsMobileView] = useState(false);
    
    useEffect(() => {
        const checkScreenSize = () => {
            if (typeof window !== 'undefined') {
                 setIsMobileView(window.innerWidth < 768);
            }
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const handlePrevMonth = useCallback(() => { 
        const newMonth = (startMonth - 1 + 12) % 12;
        const newYear = startMonth === 0 ? year - 1 : year;
        setStartMonth(newMonth); 
        setYear(newYear);
    }, [startMonth, year, setStartMonth, setYear]);
      
    const handleNextMonth = useCallback(() => { 
        const newMonth = (startMonth + 1) % 12;
        const newYear = startMonth === 11 ? year + 1 : year;
        setStartMonth(newMonth); 
        setYear(newYear); 
    }, [startMonth, year, setStartMonth, setYear]);

    const monthsToDisplay = useMemo(() => {
        const months = [];
        const count = isMobileView ? 1 : 3; 
        for (let i = 0; i < count; i++) {
          const monthIndex = (startMonth + i) % 12;
          months.push(monthIndex);
        }
        return months;
    }, [startMonth, isMobileView]);

    const selectedKeys = useMemo(() => new Set(selectedDates.map(getDayKey)), [selectedDates]);
    const attendanceSet = useMemo(() => new Set(actualAttendanceDates), [actualAttendanceDates]); 

    return (
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Pilih Tanggal Ibadah
            </h2>
            
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <button 
                  onClick={handlePrevMonth} 
                  className="rounded-full p-2 text-indigo-600 hover:bg-indigo-100 transition"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                
                <div className="flex items-center gap-3">
                    <h2 
                      className={`text-xl md:text-2xl font-bold text-gray-800 cursor-pointer hover:text-indigo-600 transition px-4 py-2 rounded-lg ${
                        viewMode === 'monthly_summary' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'hover:bg-indigo-100'
                      }`}
                      onClick={() => setShowYearDialog(true)}
                    >
                      Tahun {year}
                    </h2>
                </div>
                
                <button 
                  onClick={handleNextMonth} 
                  className="rounded-full p-2 text-indigo-600 hover:bg-indigo-100 transition"
                  aria-label="Next Month"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
            </div>
            
            {/* Apply grid changes based on screen size: grid-cols-1 on mobile, md:grid-cols-3 on desktop */}
            <div className={`grid grid-cols-1 ${isMobileView ? 'gap-0' : 'md:grid-cols-3 gap-4'}`}>
              {monthsToDisplay.map((monthIndex) => {
                const daysInMonth = getDaysInMonth(monthIndex, year);
                const firstDay = getFirstDayOfMonth(monthIndex, year);
                // Menyesuaikan startDayOffset untuk memulai Senin (0=Minggu, 1=Senin)
                const startDayOffset = firstDay === 0 ? 6 : firstDay - 1; 
                const daysArray: (number | null)[] = [
                  ...Array(startDayOffset).fill(null) as (number | null)[],
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                  
                return (
                  <div key={`${year}-${monthIndex}`} className="bg-white rounded-xl border border-gray-100">
                    <h4 
                      className="mb-3 pt-4 text-center text-sm md:text-md font-bold text-indigo-600 cursor-pointer hover:text-indigo-800 transition"
                      onClick={() => handleSelectMonth(monthIndex, year)} 
                      role="button"
                    >
                      {monthNames[monthIndex]} {year}
                    </h4>
                    <div className="grid grid-cols-7 text-xs font-semibold text-gray-600 mb-2">
                      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                        <div key={d} className="text-center">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm p-4 pt-0"> 
                      {daysArray.map((day, i) => {
                        if (day === null) return <div key={i} className="p-1"></div>;
                        
                        const thisDate = new Date(year, monthIndex, day);
                        const dayKey = getDayKey(thisDate);
                        const isSelected = selectedKeys.has(dayKey);
                        const dateTimestamp = new Date(thisDate).setHours(0, 0, 0, 0);
                        const isFutureDay = dateTimestamp > todayStart;
                        
                        // 💡 LOGIC DOT: Cek apakah ada data kehadiran di tanggal ini
                        const hasAttendanceData = attendanceSet.has(dayKey); 
                        
                        // Perubahan 1: Hapus logic yang membatasi klik, tambahkan 'cursor-pointer' global.
                        let dayClass = "relative p-1.5 rounded-full transition-all duration-150 text-xs md:text-sm cursor-pointer";
                        
                        if (isSelected) {
                          dayClass += " bg-indigo-600 text-white font-bold shadow-md"; 
                        } else if (isFutureDay) {
                          // Allow click, but style differently to indicate future
                          dayClass += " text-indigo-400 font-normal hover:bg-indigo-100";
                        } else { 
                          // Past/Present
                          dayClass += " text-gray-700 hover:bg-indigo-200";
                        }

                        return (
                          <div 
                            key={i} 
                            className={dayClass} 
                            // Perubahan 2: Memastikan semua tanggal dapat di klik
                            onClick={() => handleSelectDate(day, monthIndex)} 
                            role="button"
                          >
                            {day}
                            {/* 💡 Titik hanya muncul jika ADA data kehadiran DAN TIDAK terpilih */}
                            {hasAttendanceData && !isSelected && ( 
                              <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-red-600`}></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
    );
};


// --- LOGIKA DAFTAR EVENT (FROM database.tsx - READ ONLY) ---
interface SelectedEventsSectionProps {
    selectedDates: Date[];
    selectedEventsByDate: SelectedEventsByDate;
    events: EventsCache;
    viewMode: ViewMode;
    handleSelectEvent: (dateKey: string, event: string) => void;
    // NEW: Tambahkan weeklyEvents (read-only)
    weeklyEvents: WeeklyEvent[]; 
}

const SelectedEventsSection = ({
    selectedDates, selectedEventsByDate, events, viewMode,
    handleSelectEvent, weeklyEvents 
}: SelectedEventsSectionProps) => {
    
    const selectedDateKeys = useMemo(() => selectedDates.map(getDayKey), [selectedDates]);
    
    // Tanda Event Berkala
    const periodicalEventNames = useMemo(() => 
        new Set(weeklyEvents.map(we => we.title)), 
        [weeklyEvents]
    );

    return (
        // Menggunakan max-h-screen untuk scroll di layar besar
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 lg:sticky lg:top-8 h-fit lg:max-h-[80vh]"> 
            <h3 className="text-lg font-bold text-indigo-700 mb-4 border-b pb-2">
              {selectedDates.length} Tanggal Dipilih ({viewMode === 'monthly_summary' ? '1 Tabel' : `${selectedDateKeys.reduce((acc, key) => acc + (selectedEventsByDate[key]?.length ?? 0), 0)} Event`})
            </h3>
            
            <div className="max-h-[calc(80vh-7rem)] overflow-y-auto pr-2 space-y-4">
              {selectedDates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-2 opacity-30" />
                  <p>Pilih tanggal di kalender</p>
                </div>
              ) : (
                selectedDates.map((date) => {
                  const key = getDayKey(date);
                  const dateDisplay = date.toLocaleDateString("id-ID", { 
                    day: "2-digit", 
                    month: "long",
                    year: "numeric"
                  });
                  const currentEvents = events[key] ?? [];
                  const selectedEvents = selectedEventsByDate[key] ?? [];
                  
                  return (
                    <div key={key} className="p-3 sm:p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50"> 
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-800 text-sm">{dateDisplay}</span>
                        {/* Tombol + Event Dihapus */}
                      </div>
                      {currentEvents.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <p className="text-sm mb-2">Tidak ada event di tanggal ini</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {currentEvents.map((ev, idx) => {
                                const isSelected = selectedEvents.includes(ev);
                                const isOverall = ev === "KESELURUHAN DATA HARI INI";
                                const isPeriodical = periodicalEventNames.has(ev);

                                return (
                                <div key={ev+idx} className="relative inline-block">
                                    <button
                                        onClick={() => handleSelectEvent(key, ev)} 
                                        className={`text-xs px-3 py-1.5 rounded-lg transition text-left relative
                                          ${isOverall 
                                            ? isSelected 
                                              ? 'bg-green-600 text-white' 
                                              : 'border-2 border-green-300 text-green-700 hover:bg-green-100'
                                            : isSelected
                                              ? 'bg-indigo-600 text-white' 
                                              : 'border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                                          }
                                          ${isPeriodical ? 'shadow-lg border-purple-500 ring-2 ring-purple-300' : ''}
                                        `}
                                    >
                                        {ev}
                                        {isPeriodical && (
                                            <span className="absolute top-[-4px] right-[-4px] text-[8px] bg-purple-600 text-white px-1 rounded-full font-bold">R</span>
                                        )}
                                    </button>
                                    
                                    {/* Hapus tombol Edit dan Hapus Event */}
                                </div>
                                );
                            })}
                          </div>
                          {selectedEvents.length === 0 && (
                            <p className="mt-3 text-xs text-red-600 font-medium bg-red-50 p-2 rounded">
                              Pilih minimal 1 event!
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
        </div>
    );
};


// --- KOMPONEN UTAMA ---
export default function DatabasePage() {
  const router = useRouter();
    // ✅ Auth check (user only)
    useEffect(() => {
      const checkRole = async () => {
        const res = await fetch("/api/me");
        const data = (await res.json()) as { role?: "admin" | "user" };
        if (data.role !== "user") {
          void router.push("/unauthorized");
        }
      };
      void checkRole();
    }, [router]);

  // Jemaat Unik (digunakan untuk summary/filter)
  const [uniqueJemaatList, setUniqueJemaatList] = useState<UniqueJemaat[]>([]); 
  // Records Kehadiran (digunakan untuk tabel/filtering)
  const [attendanceRecords, setAttendanceRecords] = useState<JemaatRow[]>([]); 
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]); 
  const [isLoading, setIsLoading] = useState(true); 
  
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>((currentMonth - 1 + 12) % 12);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<SelectedEventsByDate>({});
  const [events, setEvents] = useState<EventsCache>(() => memoryStorage.events || {});
  const [actualAttendanceDates, setActualAttendanceDates] = useState<string[]>([]); 
  const [viewMode, setViewMode] = useState<ViewMode>('event_per_table');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  const [tablePage, setTablePage] = useState(1);
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false);
  // Menggunakan JemaatRow untuk detail drawer
  const [formData, setFormData] = useState<JemaatRow | null>(null); 
  const itemsPerPage = 10;
  
  const [filterStatusKehadiran, setFilterStatusKehadiran] = useState<StatusKehadiran | "">(""); 
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiranSesi, setFilterKehadiranSesi] = useState(""); 
  
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  
  const selectedDatesOnly = useMemo(() => selectedDates.map(getDayKey), [selectedDates]); 

  const handleGoToStats = useCallback(() => {
    const datesParam = selectedDatesOnly.join(','); 
    const dateQuery = datesParam.length > 0 ? `?dates=${datesParam}` : '';
    void router.push(`/statistic${dateQuery}`);
  }, [router, selectedDatesOnly]);
  
  useEffect(() => {
    const initialSelection = loadSelection();
    setSelectedDates(initialSelection.dates);
    setSelectedEventsByDate(initialSelection.events);
    setEvents(memoryStorage.events || {});
  }, []);

  useEffect(() => {
    // 💡 FUNGSI INI MENGAMBIL DATA UTAMA DARI TABEL KEHADIRAN & JEMAAT + WEEKLY EVENTS
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch both necessary data sources
        const [jemaatRes, weeklyEventsRes] = await Promise.all([
          fetch("/api/jemaat"), // Data Jemaat dan Kehadiran (full)
          fetch("/api/weekly-events"), // Data Event Berkala
        ]);

        // --- 1. PROSES DATA JEMAAT/KEHADIRAN ---
        const data: unknown = await jemaatRes.json();
        const apiResponse = data as JemaatAPIResponse;
        
        if (apiResponse.error) {
          console.error("API Jemaat Error Body:", apiResponse.error);
          throw new Error(apiResponse.error);
        }
        if (!jemaatRes.ok) {
          throw new Error(`Gagal fetch data jemaat. Status: ${jemaatRes.status}`);
        }

        const fetchedUniqueJemaat = apiResponse.jemaatData ?? [];
        setUniqueJemaatList(fetchedUniqueJemaat);

        setAttendanceRecords(apiResponse.fullAttendanceRecords ?? []);

        const fetchedAttendanceDates = apiResponse.attendanceDates || [];

        setActualAttendanceDates(fetchedAttendanceDates); 
        
        // Ambil semua sesi unik dari data kehadiran 
        const allUniqueSessions = new Set<string>(apiResponse.fullAttendanceRecords?.map(j => j.kehadiranSesi).filter(s => s) ?? []);

        // --- 2. PROSES DATA WEEKLY EVENTS ---
        let fetchedWeeklyEvents: WeeklyEvent[] = [];
        if (weeklyEventsRes.ok) {
            fetchedWeeklyEvents = await weeklyEventsRes.json() as WeeklyEvent[];
            setWeeklyEvents(fetchedWeeklyEvents);
        } else {
          const errorData = (await weeklyEventsRes.json().catch(() => ({
            error: "Unknown weekly-events API error."
          }))) as { error?: string };
            console.error("API Weekly Events Error:", errorData);
        }

        // --- 3. INTEGRASI DAN CACHE EVENT ---
        const initialEvents: EventsCache = {};

        fetchedAttendanceDates.forEach(dateKey => {
            const date = new Date(dateKey);
            // Gunakan sesi unik sebagai base event list
            initialEvents[dateKey] = populateEventsForDate(dateKey, date, allUniqueSessions); 
        });
        
        // Menggunakan Logika Integrasi yang Benar
        const mergedEvents = integrateWeeklyEvents(fetchedWeeklyEvents, initialEvents, allUniqueSessions);
        
        setEvents(mergedEvents);
        memoryStorage.events = mergedEvents;
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data (unknown error).";
        console.error("Error fetch data:", errorMessage);
        setUniqueJemaatList([]);
        setAttendanceRecords([]);
        setActualAttendanceDates([]); 
        setWeeklyEvents([]); 
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []); 

  // Perbarui useEffect untuk Caching/Integrating Events yang tampil di kalender
  useEffect(() => {
    const newEvents: EventsCache = {};
    const count = window.innerWidth < 768 ? 1 : 3; 
    const months = [];
    for (let i = 0; i < count; i++) {
      const monthIndex = (startMonth + i) % 12;
      months.push(monthIndex);
    }
    
    const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));

    months.forEach(month => {
        // Gunakan getDatesWithEventsInMonth versi user (yang bergantung pada actualAttendanceDates)
        const datesInMonth = getDatesWithEventsInMonth(month, year, memoryStorage.events, actualAttendanceDates); 
        datesInMonth.forEach(d => {
            const date = d.date;
            const dateKey: string = d.key;
            
            let currentEvents = memoryStorage.events[dateKey];
            
            // PERUBAHAN KRITIS 3: Populasikan event HANYA JIKA ada data kehadiran aktual
            if (!currentEvents || currentEvents.length === 0) {
              if (actualAttendanceDates.includes(dateKey)) {
                currentEvents = populateEventsForDate(dateKey, date, allUniqueSessions);
              } else {
                currentEvents = []; // Jika tidak ada data kehadiran, event list kosong
              }
            }
            
            const dayOfWeek = date.getDay();
            
            // Integrate Weekly Events for the currently viewed month (Logic from database.tsx)
            weeklyEvents.forEach(event => {
              const startDate = new Date(event.start_date).setHours(0, 0, 0, 0);
              const endDate = event.end_date
                ? new Date(event.end_date).setHours(0, 0, 0, 0)
                : Infinity;

              const currentDateTimestamp = date.setHours(0, 0, 0, 0);

              if (currentDateTimestamp >= startDate && currentDateTimestamp <= endDate) {
                if (
                  event.repetition_type === 'Monthly' ||
                  dayOfWeek === event.day_of_week ||
                  event.repetition_type === 'Once'
                ) {
                  const eventName = event.title;
                  const lowerEventName = eventName.toLowerCase();

                  const safeCurrentEvents = currentEvents ?? [];

                  if (!safeCurrentEvents.some(e => e.toLowerCase() === lowerEventName)) {
                    // Hanya tambahkan jika tidak ada data kehadiran (currentEvents kosong) ATAU
                    // jika ada data kehadiran tapi event ini belum terdaftar (kasus event berkala di hari attendance)
                    const listWithoutOverall = safeCurrentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI");
                    const hasOverall = safeCurrentEvents.includes("KESELURUHAN DATA HARI INI");
                    
                    let updatedList = [...listWithoutOverall, eventName];
                    updatedList = [...new Set(updatedList)].filter(v => v.trim() !== "");

                    if (hasOverall) {
                        updatedList.unshift("KESELURUHAN DATA HARI INI");
                    }
                    
                    currentEvents = updatedList;
                  }
                }
              }
            });

            
            if (currentEvents.length > 0 && JSON.stringify(currentEvents) !== JSON.stringify(memoryStorage.events[d.key])) {
               newEvents[d.key] = currentEvents;
            }
        });
    });
    
    if (Object.keys(newEvents).length > 0) {
      setEvents(prev => ({ ...prev, ...newEvents }));
      memoryStorage.events = { ...memoryStorage.events, ...newEvents };
    }
  }, [startMonth, year, attendanceRecords, weeklyEvents, actualAttendanceDates]); 

  useEffect(() => {
    memoryStorage.events = events;
  }, [events]);

  const selectedTables = useMemo(() => {
    const tables: {date: string, event: string}[] = [];
    if (viewMode === 'monthly_summary') return tables;
    
    selectedDates.forEach((date) => {
      const dateKey = getDayKey(date);
      const evts = selectedEventsByDate[dateKey] ?? [];
      evts.filter(event => event).forEach((event) => { 
        tables.push({ date: dateKey, event });
      });
    });
    return tables;
  }, [selectedDates, selectedEventsByDate, viewMode]);
  
  useEffect(() => {
    setTablePage(1);
  }, [filterStatusKehadiran, filterJabatan, filterKehadiranSesi, selectedDates, viewMode]); 

  const handleSelectMonth = useCallback((monthIndex: number, currentYear: number, forceMonthlySummary = false) => {
    
    if (viewMode === 'monthly_summary' && !forceMonthlySummary && monthIndex === startMonth && currentYear === year) {
        setViewMode('event_per_table');
        setSelectedDates([]);
        setSelectedEventsByDate({});
        saveSelection([], {});
        return;
    }

    const datesWithEventsInMonth = getDatesWithEventsInMonth(monthIndex, currentYear, memoryStorage.events, actualAttendanceDates);
    
    const newDates = datesWithEventsInMonth.map(d => d.date);
    const newEventsByDate: SelectedEventsByDate = {};
    
    const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));
    
    datesWithEventsInMonth.forEach(d => {
        // Gunakan sesi unik sebagai base event list
        const eventsList = memoryStorage.events[d.key] ?? populateEventsForDate(d.key, d.date, allUniqueSessions); 
        const overallEvent = eventsList.find(e => e === "KESELURUHAN DATA HARI INI");
        newEventsByDate[d.key] = overallEvent ? [overallEvent] : [];
        
        // Ensure initial population happens if it hasn't or was empty
        if (!memoryStorage.events) {
          memoryStorage.events = {};
        }

        if ((memoryStorage.events[d.key]?.length ?? 0) === 0) {
          memoryStorage.events[d.key] = eventsList;
        }
    });
    
    setEvents(prev => ({ ...prev, ...memoryStorage.events }));
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
    
    setStartMonth(monthIndex);
    setYear(currentYear);
    setViewMode('monthly_summary');
  }, [viewMode, startMonth, year, setStartMonth, setYear, attendanceRecords, actualAttendanceDates]); 

  useEffect(() => {
    // Logic untuk inisialisasi dari URL query (dari database.tsx)
    if (!router.isReady || isLoading || uniqueJemaatList.length === 0 || attendanceRecords.length === 0 || actualAttendanceDates.length === 0) return; 

    const { dates, date, mode, event: eventQuery } = router.query;
    
    const currentEventsCache = memoryStorage.events;
    const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));

    if (typeof dates === 'string' && dates.includes(',')) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const datesArray = dates.split(',').filter(d => dateRegex.exec(d));
        const firstDate = datesArray.length > 0 && datesArray[0] !== undefined ? new Date(datesArray[0]) : null;
        
        if (!firstDate) return;

        const newSelectedDates: Date[] = [];
        const newSelectedEventsByDate: SelectedEventsByDate = {};
        const targetMonth = firstDate.getMonth();
        const targetYear = firstDate.getFullYear();
        
        datesArray.forEach(dateKey => {
            const dateObj = new Date(dateKey);
            
            // Generate events if missing from cache
            let availableEvents = currentEventsCache[dateKey];
            if (!availableEvents) { // No longer restricted by actualAttendanceDates
                availableEvents = populateEventsForDate(dateKey, dateObj, allUniqueSessions);
                currentEventsCache[dateKey] = availableEvents;
            }

            let selectedEvents: string[] = [];
            
            if (typeof eventQuery === 'string' && eventQuery) {
                const decodedEvent = decodeURIComponent(eventQuery);
                if (availableEvents.includes(decodedEvent)) {
                    selectedEvents = [decodedEvent];
                }
            } else {
                const overallEvent = availableEvents.find(e => e === "KESELURUHAN DATA HARI INI");
                if (overallEvent) {
                    selectedEvents = [overallEvent];
                }
            }
            
            if (selectedEvents.length > 0) {
                newSelectedDates.push(dateObj);
                newSelectedEventsByDate[dateKey] = selectedEvents;
            }
        });
        
        setEvents({ ...currentEventsCache });
        setSelectedDates(newSelectedDates.sort((a, b) => a.getTime() - b.getTime()));
        setSelectedEventsByDate(newSelectedEventsByDate);
        setStartMonth(targetMonth);
        setYear(targetYear);
        setViewMode('event_per_table'); 
        saveSelection(newSelectedDates, newSelectedEventsByDate);
        
        void router.replace(router.pathname, undefined, { shallow: true });
        return;
    }

    if (typeof dates === 'string' && /^\d{4}-\d{2}-\d{2}$/.exec(dates)) {
        const dateKey = dates;
        const targetDate = new Date(dateKey);
        
        if (isNaN(targetDate.getTime())) return;
        
        
        let availableEvents = currentEventsCache[dateKey];
        
        if (!availableEvents) { // No longer restricted by actualAttendanceDates
            availableEvents = populateEventsForDate(dateKey, targetDate, allUniqueSessions);
            currentEventsCache[dateKey] = availableEvents;
        }

        const overallEvent = availableEvents.find(e => e === "KESELURUHAN DATA HARI INI");
        const selectedEvents = overallEvent ? [overallEvent] : []; 
        
        setEvents({ ...currentEventsCache });
        setSelectedDates([targetDate]);
        setSelectedEventsByDate({ [dateKey]: selectedEvents });
        setStartMonth(targetDate.getMonth());
        setYear(targetDate.getFullYear());
        setViewMode('event_per_table'); 
        saveSelection([targetDate], { [dateKey]: selectedEvents });
        
        void router.replace(router.pathname, undefined, { shallow: true });
        return;
    }
    
    if (typeof date === 'string' && /^\d{4}-\d{2}$/.exec(date) && mode === 'monthly') {
        const y = parseInt(date.substring(0, 4), 10);
        const m = parseInt(date.substring(5, 7), 10) - 1;
        
        handleSelectMonth(m, y, true);
        
        void router.replace(router.pathname, undefined, { shallow: true });
        return;
    }
  }, [router, isLoading, uniqueJemaatList.length, handleSelectMonth, actualAttendanceDates, attendanceRecords]); 

  // 💡 LOGIC UTAMA: Menghandle klik di kalender 
  const handleSelectDate = useCallback((day: number, month: number) => {
    setViewMode('event_per_table'); 
    
    const clickedDate = new Date(year, month, day);
    const key = getDayKey(clickedDate);
    
    const isCurrentlySelected = selectedDates.some(d => getDayKey(d) === key);
    
    // Handle Event Caching/Generation for ANY selected date (past/present/future)
    let currentEvents = events[key];
    const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));
    
    // PERUBAHAN KRITIS: Populasikan event HANYA JIKA ada data kehadiran aktual
    // Jika tidak ada data kehadiran aktual, event list dibiarkan kosong, sehingga 
    // SelectedEventsSection menampilkan "Tidak ada event di tanggal ini".
    if (!currentEvents || currentEvents.length === 0) {
      if (actualAttendanceDates.includes(key)) {
        currentEvents = populateEventsForDate(key, clickedDate, allUniqueSessions);
      } else {
        currentEvents = []; // ✅ Pastikan tetap array
      }

      const safeEvents = currentEvents ?? [];

      setEvents(prev => ({
        ...prev,
        [key]: safeEvents, 
      }));

      memoryStorage.events[key] = safeEvents; 
    }



    let newDates: Date[];
    const newEventsByDate = { ...selectedEventsByDate };
    const overallEvent = (currentEvents ?? []).find(e => e === "KESELURUHAN DATA HARI INI");

    if (isCurrentlySelected) {
      // DESELECT
      newDates = selectedDates.filter(d => getDayKey(d) !== key);
      delete newEventsByDate[key];
    } else {
      // SELECT
      newDates = [...selectedDates, clickedDate].sort((a, b) => a.getTime() - b.getTime());
      
      // Otomatis pilih 'KESELURUHAN DATA HARI INI' jika ada
      newEventsByDate[key] = overallEvent ? [overallEvent] : []; 
    }
    
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
  }, [events, selectedDates, selectedEventsByDate, year, attendanceRecords, actualAttendanceDates]);


  // **PERBAIKAN 2: Logika Pemilihan Event Berkala** (dari database.tsx)
  const handleSelectEvent = useCallback((dateKey: string, eventName: string) => {
      setViewMode('event_per_table'); 
      
      const isPeriodicalEvent = weeklyEvents.find(e => e.title === eventName);
      
      if (isPeriodicalEvent) {
          // --- LOGIKA SELEKSI EVENT BERKALA ---
          
          const startDate = new Date(isPeriodicalEvent.start_date);
          const endDate = isPeriodicalEvent.end_date 
              ? new Date(isPeriodicalEvent.end_date) 
              : new Date(today.getFullYear() + 10, 0, 1); 
          
          const newDates: Date[] = [];
          const newEventsByDate: SelectedEventsByDate = {};
          
          const currentDate = new Date(startDate);
          
          // Iterasi hari demi hari dari start_date hingga end_date (hanya sampai hari ini/sebelumnya)
          while (currentDate.getTime() <= endDate.getTime() && currentDate.getTime() <= todayStart) {
              const currentKey = getDayKey(currentDate);
              const dayOfWeek = currentDate.getDay(); 

              // Filter ketat: tanggal harus match hari repetisi ATAU event sekali jalan/bulanan
              const isCorrectDay = isPeriodicalEvent.repetition_type === 'Once' 
                || isPeriodicalEvent.repetition_type === 'Monthly' // Tambahkan cek bulanan
                || dayOfWeek === isPeriodicalEvent.day_of_week;

              if (isCorrectDay) {
                  
                  const availableEvents = events[currentKey] ?? [];
                  if (availableEvents.includes(eventName)) {
                      newDates.push(new Date(currentKey));
                      newEventsByDate[currentKey] = [eventName]; 
                  }
              }
              
              currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Atur state
          setSelectedDates(newDates.sort((a, b) => a.getTime() - b.getTime()));
          setSelectedEventsByDate(newEventsByDate);
          saveSelection(newDates, newEventsByDate);

      } else {
          // --- LOGIKA SELEKSI EVENT SATUAN (untuk event non-periodik) ---
          setSelectedEventsByDate(prev => {
              const current = prev[dateKey] ?? [];
              const isEventSelected = current.includes(eventName);
              
              let updated: string[];
              
              if (eventName === "KESELURUHAN DATA HARI INI") {
                  if (isEventSelected) {
                      updated = current.filter(e => e !== eventName); 
                  } else {
                      updated = [eventName];
                  }
              } else {
                  if (isEventSelected) {
                      updated = current.filter((e: string) => e !== eventName);
                  } else {
                      updated = [...current.filter(e => e !== "KESELURUHAN DATA HARI INI"), eventName];
                  }
              }
              
              const newEventsByDate = { ...prev, [dateKey]: updated.filter(e => e) };
              saveSelection(selectedDates, newEventsByDate);
              return newEventsByDate;
          });
      }

  }, [selectedDates, weeklyEvents, events]);


  const handleSelectYearFromGrid = useCallback((selectedYear: number) => {
    setYear(selectedYear);
    setShowYearDialog(false);
  }, []);
  
  const calculatedAge = useMemo(() => {
    return calculateAge(formData?.tanggalLahir);
  }, [formData?.tanggalLahir]);
  
  // LOGIKA FILTER UTAMA: Filter data JemaatRow (Attendance Records) - Disesuaikan dari database.tsx
  
  const getFilteredJemaatPerEvent = useCallback((
    attendanceRecords: JemaatRow[], 
    dateKey: string, 
    event: string, 
  ): JemaatRow[] => {
      
    // STEP 1: Filter KETAT - hanya record kehadiran yang tanggalKehadirannya PERSIS SAMA dengan dateKey
    const filteredByDate = attendanceRecords.filter(j => j.tanggalKehadiran === dateKey);

    if (filteredByDate.length === 0) return [];
    
    // STEP 2: Filter berdasarkan status kehadiran dan jabatan
    const filteredData = filteredByDate.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan)
    );
    
    if (event === "KESELURUHAN DATA HARI INI") {
        // Untuk keseluruhan data hari ini, tampilkan semua record kehadiran di tanggal ini
        if (filterKehadiranSesi !== "") {
            return filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        return filteredData; 
    }
    
    // Filter berdasarkan sesi spesifik
    return filteredData.filter(j => j.kehadiranSesi === event);
  }, [filterStatusKehadiran, filterJabatan, filterKehadiranSesi]);

  const getFilteredJemaatMonthlySummary = useCallback((
      uniqueJemaatList: UniqueJemaat[], 
      attendanceRecords: JemaatRow[], 
  ): JemaatRow[] => {
      if (selectedDatesOnly.length === 0) return [];
      
      // 1. Tentukan ID jemaat unik yang hadir di SELURUH selectedDatesOnly
      const uniqueJemaatIdsInSelectedDates = new Set<string>();
      
      attendanceRecords.forEach(j => {
        if (selectedDatesOnly.includes(j.tanggalKehadiran)) {
          const jemaatId = j.id.split('-')[0] ?? j.id; // Ambil ID jemaat saja (id_jemaat)
          uniqueJemaatIdsInSelectedDates.add(jemaatId); 
        }
      });

      // 2. Filter list Jemaat Attendance Records berdasarkan ID unik yang hadir
      let filteredRecords = attendanceRecords.filter(j => 
          uniqueJemaatIdsInSelectedDates.has(j.id.split('-')[0] ?? j.id)
      );
      
      // 3. Filter berdasarkan status dan jabatan
      filteredRecords = filteredRecords.filter(j =>
          (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
          (filterJabatan === "" || j.jabatan === filterJabatan)
      );
      
      // 4. Filter sesi kehadiran (jika ada)
      if (filterKehadiranSesi !== "") {
          filteredRecords = filteredRecords.filter(j => j.kehadiranSesi === filterKehadiranSesi);
      }

      // 5. Hapus duplikat jemaat (hanya ambil satu representasi per jemaat)
      const seenJemaatIds = new Set<string>();
      const deDuplicatedRecords: JemaatRow[] = []; 
      filteredRecords.forEach(j => {
          const jemaatId = j.id.split('-')[0] ?? j.id;
          if (!seenJemaatIds.has(jemaatId)) {
              seenJemaatIds.add(jemaatId);
              
              // Cari data jemaat unik terbaru
              const uniqueJemaatData = uniqueJemaatList.find(uj => uj.id === jemaatId);
              
              // Gabungkan data kehadiran yang sudah difilter dengan data jemaat unik terbaru
              if (uniqueJemaatData) {
                  deDuplicatedRecords.push({
                      ...j, // Ambil id_kehadiran, waktuPresensiFull, tanggalKehadiran
                      ...uniqueJemaatData, // Timpa data lama dengan data unik terbaru (nama, status, jabatan dll)
                      id: j.id, // Pastikan ID record kehadiran tetap benar
                  } as JemaatRow);
              } else {
                  deDuplicatedRecords.push(j);
              }
          }
      });
      
      return deDuplicatedRecords; 
  }, [
      selectedDatesOnly,
      filterStatusKehadiran,
      filterJabatan,
      filterKehadiranSesi
    ]);


  const getFilteredJemaat = useCallback((
    uniqueJemaatList: UniqueJemaat[], 
    attendanceRecords: JemaatRow[]
  ): JemaatRow[] => {

    if (viewMode === 'monthly_summary') {
        return getFilteredJemaatMonthlySummary(
            uniqueJemaatList, 
            attendanceRecords, 
        );
    }
    
    if (selectedTables.length === 1 && selectedTables[0]) {
        // Gabungkan data filter event dengan data jemaat unik terbaru
        const filteredByEvent = getFilteredJemaatPerEvent(
            attendanceRecords, 
            selectedTables[0].date, 
            selectedTables[0].event,
        );
        
        // Perluas data dengan data jemaat unik terbaru
        return filteredByEvent.map(j => {
            const jemaatId = j.id.split('-')[0] ?? j.id;
            const uniqueJemaatData = uniqueJemaatList.find(uj => uj.id === jemaatId);

            if (uniqueJemaatData) {
                return {
                    ...j, 
                    ...uniqueJemaatData, 
                    id: j.id, // Pertahankan ID record kehadiran
                } as JemaatRow;
            }
            return j;
        });
    }

    // Jika multiple tables atau no selection, return empty list
    if (selectedTables.length > 1) {
        return [];
    }
    
    return [];
  }, [
      viewMode,
      selectedTables,
      getFilteredJemaatMonthlySummary,
      getFilteredJemaatPerEvent
    ]);
  // FIX 5: Perbarui dataForPagination
  const dataForPagination = useMemo(() => getFilteredJemaat(uniqueJemaatList, attendanceRecords), [uniqueJemaatList, attendanceRecords, getFilteredJemaat]);
  const filteredCount = dataForPagination.length;
  const totalPages = Math.ceil(filteredCount / itemsPerPage);
  
  const getPagedData = useCallback((jemaatList: JemaatRow[]) => {
    const filtered = jemaatList; 
    const indexOfLast = tablePage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    // Fix slice end index (database.tsx uses indexOfFirst + itemsPerPage)
    return filtered.slice(indexOfFirst, indexOfFirst + itemsPerPage); 
  }, [tablePage]);
  
  // FIX 7: Ambil dari list unik
  const uniqueJabatan = useMemo(() => 
    [...new Set(uniqueJemaatList.map((j) => j.jabatan).filter(j => j) as string[])], [uniqueJemaatList]);
    
  // FIX 8: Ambil dari list kehadiran granular
  const uniqueKehadiranSesiByDate = useMemo(() => {
    // Ambil semua sesi unik dari attendance records (yang merupakan jenis_kebaktian)
    const allUniqueSessions = Array.from(new Set(attendanceRecords.map((j) => j.kehadiranSesi).filter(s => s)));

    if (selectedTables.length === 0 || viewMode === 'monthly_summary') {
        return allUniqueSessions.sort();
    }
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return allUniqueSessions.sort();
    } 
    
    if (selectedTables.length > 0 && selectedTables[0]) {
        // Jika event spesifik sudah terpilih, filter tidak perlu menampilkan sesi lain
        return allUniqueSessions.includes(selectedTables[0].event) ? [selectedTables[0].event] : allUniqueSessions.sort();
    }
    
    return allUniqueSessions.sort();
  }, [attendanceRecords, selectedTables, viewMode]);

  // FIX 9: Perbarui handleRowClick (menggunakan JemaatRow)
  const handleRowClick = useCallback((row: JemaatRow) => {
      // Tidak ada edit mode, langsung tampilkan
      setFormData({ ...row });
      setOpenDetailDrawer(true);
  }, []);
  
  const tablesToRender = useMemo(() => {
    if (viewMode === 'monthly_summary') {
      if (selectedDatesOnly.length === 0) return [];
      return [{ date: getDayKey(new Date(year, startMonth, 1)), event: 'KESELURUHAN BULAN INI' }];
    } else {
      // 💡 Hanya tampilkan 1 tabel (jika ada event terpilih)
      return selectedTables.length === 1 && selectedTables[0] ? [selectedTables[0]] : [];
    }
  }, [viewMode, selectedTables, selectedDatesOnly.length, startMonth, year]);

  const handleDownload = useCallback(async (format: 'csv' | 'pdf') => {
    if (tablesToRender.length === 0) {
        alert("Download Gagal: Tidak ada data untuk diunduh. Pilih tanggal dan event terlebih dahulu.");
        return;
    }
    
    setOpenDownloadDialog(false);
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'download-loading';
    loadingDiv.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[999]';
    loadingDiv.innerHTML = `
      <div class="bg-white p-6 rounded-xl shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span class="text-lg font-semibold text-gray-800">Membuat ${format.toUpperCase()} (${tablesToRender.length} tabel)...</span>
        </div>
      </div>
    `;
    document.body.appendChild(loadingDiv);

    try {
        const startDate = selectedDates.length > 0 ? selectedDates[0] : undefined;
        const endDate = selectedDates.length > 0 ? selectedDates[selectedDates.length - 1] : undefined;
        const dateRange = startDate && endDate
          ? `${startDate instanceof Date ? startDate.toLocaleDateString('id-ID') : new Date(startDate).toLocaleDateString('id-ID')} sampai ${endDate instanceof Date ? endDate.toLocaleDateString('id-ID') : new Date(endDate).toLocaleDateString('id-ID')}`
          : "N/A";
          
        const summaryHeader = viewMode === 'monthly_summary'
          ? `Data Gabungan Bulanan: ${monthNames[startMonth]} ${year}`
          : `Data Kehadiran Jemaat - ${dateRange}`;

        if (format === 'csv') {
          let csv = "";
          csv += `"${summaryHeader}"\n\n`;
          
          const keys: (keyof JemaatRow)[] = ['id', 'nama', 'statusKehadiran', 'jabatan', 'kehadiranSesi', 'email', 'telepon'];
          
          tablesToRender.forEach(({ date, event }, tableIndex) => {
            // Gunakan getFilteredJemaat dengan kedua list data
            const dataForTable = getFilteredJemaat(uniqueJemaatList, attendanceRecords);
            
            if (dataForTable.length === 0) return;
            
            const tableHeader = viewMode === 'monthly_summary'
              ? `Data Keseluruhan | ${monthNames[startMonth]} ${year}`
              : `${new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${event}`;
            
            csv += `\n"${tableHeader}"\n`;
            csv += `"Total Data: ${dataForTable.length}"\n`;
            
            const headers = ['ID (Attendance)', 'Nama', 'Status Kehadiran', 'Jabatan', 'Jenis Ibadah', 'Email', 'Telp'];
            csv += headers.map(h => `"${h}"`).join(",") + "\n";
            
            csv += dataForTable.map(row => 
              keys.map(key => {
              const val = row[key] ?? '';

              // Handle dokumen field for csv (just output existence or a placeholder)
              if (key === 'dokumen') return `"Dokumen tersedia"`;

              const safeString =
                typeof val === "string" ? val
                : typeof val === "number" || typeof val === "boolean" ? String(val)
                : val instanceof Date ? val.toISOString()
                : val && typeof val === "object" ? JSON.stringify(val)
                : "";


              return `"${safeString.replace(/"/g, '""')}"`; 
            }).join(",")
          ).join("\n") + "\n";
            
            if (tableIndex < tablesToRender.length - 1) {
              csv += "\n" + "=".repeat(80) + "\n";
            }
          });
          
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.setAttribute("download", `data_jemaat_${new Date().toISOString().substring(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
        } else if (format === 'pdf') {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            let isFirstTable = true;
            
            tablesToRender.forEach(({ date, event }) => {
              // Gunakan getFilteredJemaat dengan kedua list data
              const dataForTable = getFilteredJemaat(uniqueJemaatList, attendanceRecords);
              
              if (dataForTable.length === 0) return;
              
              if (!isFirstTable) {
                pdf.addPage();
              }
              isFirstTable = false;
              
              let yPosition = 20;
              
              const tableHeader = viewMode === 'monthly_summary'
                ? `Data Gabungan Bulanan: ${monthNames[startMonth]} ${year}`
                : `${new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${event}`;
              
              pdf.setFontSize(14);
              pdf.setFont('helvetica', 'bold');
              pdf.text(tableHeader, margin, yPosition);
              yPosition += 8;
              
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              pdf.text(`Total Data: ${dataForTable.length}`, margin, yPosition);
              yPosition += 10;
              
              const head = [['ID (Attendance)', 'Nama', 'Status', 'Jabatan', 'Jenis Ibadah', 'Telp']];
              const body = dataForTable.map(row => [
                  String(row.id),
                  row.nama,
                  row.statusKehadiran,
                  row.jabatan,
                  row.kehadiranSesi,
                  row.telepon ?? '-'
              ]);

              autoTable(pdf, {
                startY: yPosition,
                head: head,
                body: body,
                margin: { left: margin, right: margin },
                headStyles: { fillColor: [79, 70, 229] },
                didDrawPage: (data: { pageNumber: number }) => {
                    pdf.setFontSize(8);
                    pdf.setTextColor(128, 128, 128);
                    pdf.text(
                        `Halaman ${data.pageNumber} | ${summaryHeader} | Generated: ${new Date().toLocaleString('id-ID')}`,
                        margin,
                        pdf.internal.pageSize.getHeight() - 10
                    );
                }
              } as UserOptions);
            });
            
            pdf.save(`data_jemaat_${new Date().toISOString().substring(0, 10)}.pdf`);
        } 
      } catch (error) {
        console.error("Error generating report:", error);
        alert(`Download Gagal: Gagal membuat laporan ${format.toUpperCase()}.`);
      } finally {
        const finalLoadingDiv = document.getElementById('download-loading');
        if (finalLoadingDiv) {
            document.body.removeChild(finalLoadingDiv);
        }
      }
  }, [tablesToRender, selectedDates, viewMode, startMonth, year, uniqueJemaatList, attendanceRecords, getFilteredJemaat]);
  
  const showSesiFilter = useMemo(() => {
    if (viewMode === 'monthly_summary') return true;
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return true;
    }
    
    return false;
  }, [viewMode, selectedTables]);

  const closeSidebar = () => setIsSidebarOpen(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex-grow p-8 max-w-7xl mx-auto w-full flex justify-center items-center">
          <Loader2 size={32} className="animate-spin text-indigo-600 mr-2" />
          <p className="text-xl text-indigo-600">Memuat data jemaat...</p>
        </main>
      </div>
    );
  }

  return (
    // FIX: Set outer container to h-screen
    <div className="flex h-screen bg-gray-50"> 
      
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar - FIX: Container fixed, removed lg:relative */}
      <div className={`fixed top-0 left-0 z-40 transition-transform duration-300 transform w-64 h-screen bg-white shadow-2xl lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Pass props to Sidebar */}
        <Sidebar activeView='database' isOpen={isSidebarOpen} onClose={closeSidebar} /> 
      </div>
      
      {/* Main Content Wrapper (Handles the offset and scroll) */}
      <div className="w-full lg:ml-64 overflow-y-auto">
        <main className={`p-4 md:p-8 w-full transition-all duration-300`}> 
      
          {/* Hamburger Menu for Mobile */}
          <div className="lg:hidden flex justify-start mb-4">
              <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 rounded-full bg-indigo-600 text-white shadow-md"
              >
                  <Menu size={24} />
              </button>
          </div>

          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              Data Kehadiran Jemaat
            </h1>
            <div className="flex space-x-3 flex-wrap justify-end gap-2">
              <button 
                onClick={() => setOpenDownloadDialog(true)}
                disabled={filteredCount === 0} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg text-sm md:text-base"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Download ({filteredCount})</span> 
                <span className="sm:hidden">Download</span>
              </button>
              <button 
                onClick={handleGoToStats}
                className="flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition shadow-md hover:shadow-lg text-sm md:text-base"
              >
                <BarChart3 size={18} />
                <span className="hidden sm:inline">Statistik</span>
                <span className="sm:hidden">Stats</span>
              </button>
            </div>
          </div>
        
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <CalendarSection
              year={year}
              setYear={setYear}
              startMonth={startMonth}
              setStartMonth={setStartMonth}
              viewMode={viewMode}
              handleSelectMonth={handleSelectMonth}
              handleSelectDate={handleSelectDate}
              selectedDates={selectedDates}
              setShowYearDialog={setShowYearDialog}
              actualAttendanceDates={actualAttendanceDates}
            />
            
            <SelectedEventsSection
              selectedDates={selectedDates}
              selectedEventsByDate={selectedEventsByDate}
              events={events}
              viewMode={viewMode}
              handleSelectEvent={handleSelectEvent}
              weeklyEvents={weeklyEvents} // Pass weekly events
            />
          </div>

          {tablesToRender.length > 0 ? (
            <div className="mt-8">
              <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 flex-wrap mb-6"> 
                <span className="font-semibold text-gray-700 text-sm">Filter:</span>
                
                <select 
                  value={filterStatusKehadiran} 
                  onChange={e => setFilterStatusKehadiran(e.target.value as StatusKehadiran | "")}
                  className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none flex-grow sm:flex-grow-0 min-w-[150px]"
                >
                  <option value="">Semua Status Kehadiran</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Jarang Hadir">Jarang Hadir</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
                
                <select 
                  value={filterJabatan} 
                  onChange={e => setFilterJabatan(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none flex-grow sm:flex-grow-0 min-w-[150px]"
                >
                  <option value="">Semua Jabatan</option>
                  {uniqueJabatan.map((jab) => (
                    <option key={jab} value={jab}>{jab}</option>
                  ))}
                </select>
                
                {showSesiFilter && (
                    <select 
                      value={filterKehadiranSesi} 
                      onChange={e => setFilterKehadiranSesi(e.target.value)}
                      className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none flex-grow sm:flex-grow-0 min-w-[150px]"
                    >
                      <option value="">Semua Jenis Ibadah</option>
                      {uniqueKehadiranSesiByDate.map((sesi) => (
                        <option key={sesi} value={sesi}>{sesi}</option>
                      ))}
                    </select>
                )}
                
                {/* TOMBOL EDIT DIHAPUS */}
              </div>
              
              <div className="space-y-8" id="table-container"> 
                
                {tablesToRender.map(({ date, event }, idx) => {
                  
                  const filteredData = dataForPagination;
                  const pagedData = idx === 0 ? getPagedData(filteredData) : filteredData; 
                  
                  const tableFilteredCount = filteredData.length;
                  
                  const showPagination = idx === 0 && totalPages > 1;

                  const headerText = viewMode === 'monthly_summary'
                      ? `Data Keseluruhan | ${monthNames[startMonth]} ${year}`
                      : `${new Date(date).toLocaleDateString("id-ID", { 
                          day: "2-digit", 
                          month: "long", 
                          year: "numeric" 
                        })} - ${event}`;

                  return (
                    <div key={`${date}-${event}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden"> 
                      <div className="bg-indigo-600 p-4 text-white font-semibold flex justify-between items-center">
                        <h2 className="text-base md:text-lg">{headerText}</h2>
                        <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{tableFilteredCount} data</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        {tableFilteredCount > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-indigo-50"> 
                                <tr>
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[40px]">No</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[80px]">ID</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[60px]">Foto</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[150px]">Nama</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[150px]">Status Kehadiran</th> 
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[100px]">Jabatan</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[180px]">Jenis Ibadah/Kebaktian</th>
                                
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[80px]">Aksi</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {pagedData.map((j, i) => {
                                    const rowIndex = idx === 0 ? (tablePage - 1) * itemsPerPage + i : i; 

                                    return (
                                    <tr 
                                        key={j.id} 
                                        className="hover:bg-indigo-50 transition duration-150 cursor-pointer"
                                        onClick={() => handleRowClick(j)}
                                    >
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 text-center font-medium">
                                        {rowIndex + 1}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">
                                        {j.id.split('-')[0]} {/* Tampilkan ID Jemaat saja, bukan ID Record Kehadiran */}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                        <div className="relative w-10 h-10">
                                            <Image
                                                src={j.foto}
                                                alt={j.nama}
                                                fill
                                                className="rounded-full object-cover shadow-sm"
                                                unoptimized
                                            />
                                        </div>
                                        </td>
                                        
                                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {j.nama}
                                        </td>
                                        
                                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm ${
                                            j.statusKehadiran === "Aktif" 
                                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                                : j.statusKehadiran === "Jarang Hadir"
                                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                : 'bg-red-100 text-red-800 border border-red-200'
                                            }`}>
                                            {j.statusKehadiran}
                                            </span>
                                        </td>
                                        
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                                        {j.jabatan}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                                            {j.kehadiranSesi}
                                        </td>
                                        
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                        <button 
                                            onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleRowClick(j); 
                                            }}
                                            className="px-3 py-1.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-xs font-medium flex items-center gap-1 mx-auto" 
                                        >
                                            <Eye size={14} /> Lihat
                                        </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <p className="text-lg font-semibold">Tidak Ada Data Kehadiran</p>
                                <p className="text-sm">Tidak ada data kehadiran jemaat yang tercatat untuk tanggal/sesi ini berdasarkan filter saat ini.</p>
                            </div>
                        )}
                      </div>
                      
                      {showPagination && (
                        <div className="flex justify-center items-center gap-4 p-4 border-t bg-gray-50 flex-wrap">
                          <button 
                            disabled={tablePage === 1}
                            onClick={() => setTablePage(p => p - 1)}
                            className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition text-sm" 
                          >
                            Sebelumnya
                          </button>
                          <span className="text-gray-700 font-medium text-sm">
                            Halaman <span className="text-indigo-600 font-bold">{tablePage}</span> dari {totalPages}
                          </span>
                          <button 
                            disabled={tablePage === totalPages}
                            onClick={() => setTablePage(p => p + 1)}
                            className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition text-sm" 
                          >
                            Berikutnya
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-300"> 
              <Calendar size={64} className="text-gray-300 mb-4" />
              <p className="text-xl text-gray-500 mb-2">Belum ada data yang ditampilkan</p>
              <p className="text-sm text-gray-400">Pilih tanggal di kalender dan minimal 1 event</p>
            </div>
          )}

          {/* Detail Drawer (Read Only) */}
          {openDetailDrawer && formData && (
            // ✅ Tambahkan onClick ke overlay dan e.stopPropagation() ke drawer content
            <div 
              className="fixed inset-0 bg-black/50 flex justify-end z-50"
              onClick={() => setOpenDetailDrawer(false)}
            >
              <div 
                className="bg-white w-full max-w-md h-full overflow-y-auto animate-slide-in"
                onClick={(e) => e.stopPropagation()}
              > 
                <div className="p-6">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <h2 className="text-2xl font-bold text-indigo-700">Detail Jemaat</h2>
                    <button
                      onClick={() => setOpenDetailDrawer(false)}
                      className="text-gray-500 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <Image
                          src={formData.foto ?? "/default-avatar.png"}
                          alt={formData.nama}
                          width={112}
                          height={112}
                          className="rounded-full h-28 w-28 object-cover shadow-lg"
                          unoptimized
                        />
                        <div className="absolute bottom-0 right-0 bg-green-500 h-6 w-6 rounded-full border-4 border-white"></div>
                      </div>
                    </div>
                    <h3 className="text-center font-bold text-xl text-gray-800 mb-6">{formData.nama}</h3>

                    <div className="space-y-4">
                      {/* Read-only fields */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tanggal Lahir
                        </label>
                        <input
                          type="text" 
                          value={formData.tanggalLahir ?? "-"}
                          disabled 
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 cursor-not-allowed text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Umur (Tahun)
                        </label>
                        <input
                          type="text"
                          value={calculatedAge || "-"} 
                          disabled 
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 cursor-not-allowed text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Keluarga
                        </label>
                        <input
                          type="text"
                          value={formData.keluarga ?? "-"}
                          disabled 
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 cursor-not-allowed text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          type="text"
                          value={formData.email ?? "-"}
                          disabled 
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 cursor-not-allowed text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          No. Telp
                        </label>
                        <input
                          type="text"
                          value={formData.telepon ?? "-"}
                          disabled 
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 cursor-not-allowed text-gray-700 focus:outline-none"
                        />
                      </div>

                      <div className="pt-2"> 
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Status Kehadiran
                          </label>
                          <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-lg w-full justify-center ${
                            formData.statusKehadiran === "Aktif" 
                              ? 'bg-green-100 text-green-800' 
                              : formData.statusKehadiran === "Jarang Hadir"
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {formData.statusKehadiran}
                          </span>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Jabatan
                        </label>
                        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg px-4 py-2.5 text-gray-800 font-medium">
                          {formData.jabatan}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 flex justify-end space-x-3 border-t mt-8">
                    <button
                      onClick={() => setOpenDetailDrawer(false)}
                      className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showYearDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-indigo-700 border-b pb-3 mb-4">
                  Pilih Tahun
                </h3>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {/* Simplifikasi tahun grid (hanya 4) */}
                  {Array.from({ length: 10 }, (_, i) => year - 5 + i).map((y) => (
                    <button
                      key={y}
                      onClick={() => handleSelectYearFromGrid(y)}
                      className={`px-3 py-2 rounded-lg font-semibold transition ${
                        y === year
                          ? 'bg-indigo-600 text-white'
                          : 'border-2 border-gray-300 text-gray-700 hover:border-indigo-600'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowYearDialog(false)}
                  className="w-full px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {openDownloadDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md"> 
                <h3 className="text-xl font-semibold text-indigo-700 border-b pb-3 mb-4">
                  Download Data
                </h3>
                <p className="text-gray-700 mb-6">Pilih format file yang ingin diunduh:</p>
                <div className="flex flex-col gap-3 mb-6">
                  <button
                    onClick={() => handleDownload('csv')}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition" 
                  >
                    <Download size={20} />
                    Download CSV
                  </button>
                  <button
                    onClick={() => handleDownload('pdf')}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition" 
                  >
                    <Download size={20} />
                    Download PDF
                  </button>
                </div>
                <button
                  onClick={() => setOpenDownloadDialog(false)}
                  className="w-full px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
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