// src/pages/database.tsx

/**
 * REFACTOR: Mengganti logika Event Management menjadi modal terpusat
 * dan menambahkan fitur Event Berkala (Periodical Event) untuk penambahan,
 * pengeditan, dan penghapusan event berulang (hanya di memori).
 * FIX: Perbaikan logika generateDatesForPeriod dan penambahan event periodik
 * NEW: Responsiveness (mobile-first) dan Collapsible Sidebar.
 * FIX: Sidebar height and mobile display (Fixed white background issue).
 * **FIX**: Sidebar dibuat fixed/sticky dan konten utama dibuat scrollable.
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Download, X, Settings, ChevronLeft, ChevronRight, BarChart3, Calendar, FileText, Image as LucideImage, UploadCloud, Loader2, Pencil, Menu } from "lucide-react"; 
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';
import { jsPDF } from 'jspdf';
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
import dynamic from 'next/dynamic'; 

// --- Tipe Data ---
interface Jemaat {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif";
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string; 
  dokumen?: string;
}

export interface PreviewModalData {
    url: string; 
    name: string;
    type: 'image' | 'pdf' | 'other';
}

type ViewMode = 'event_per_table' | 'monthly_summary';
type SelectedEventsByDate = Record<string, string[]>;
type EventsCache = Record<string, string[]>;

type EventModalType = 'add-single' | 'add-periodical' | 'edit-single' | 'edit-periodical-confirm' | 'flow-select';

export interface EventModalData {
    type: EventModalType;
    dateKey: string | null;
    oldName: string | null;
    newName: string;
    periodicalDayOfWeek: number | null;
    periodicalPeriod: string;
}

interface CustomConfirmation {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    showCancelButton?: boolean;
}

// Komponen Modal yang dimuat secara dinamis
const DynamicDocumentPreviewModal = dynamic<any>(() => import('../components/DocumentPreviewModal'), {
    loading: () => null, 
    ssr: false, 
});

const DynamicEventManagementModal = dynamic<any>(() => import('../components/EventManagementModal'), {
    loading: () => (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl">Memuat form event...</div>
        </div>
    ),
    ssr: false,
});

// --- UTILITY FUNCTIONS & CONSTANTS ---
const MONTHLY_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
    value: `${i + 1}m`,
    label: `${i + 1} Bulan`,
}));

export const PERIOD_OPTIONS = [ 
  ...MONTHLY_OPTIONS,
  { value: '1y', label: '1 Tahun' },
  { value: '10y', label: 'Selamanya (10 Tahun Simulasi)' }, 
];

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

export const isImageUrlOrBase64 = (data: string): boolean => { 
    if (!data) return false;
    return data.startsWith('data:image') || 
           /\.(jpeg|jpg|png|gif|webp)$/i.test(data.toLowerCase()) || 
           data.includes('picsum.photos');
};

const getAvailableSessionNames = (date: Date): string[] => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 6) {
        return ["Ibadah Dewasa : Sabtu, 17:00", "Ibadah Lansia : Sabtu, 10:00"];
    } else if (dayOfWeek === 0) {
        return ["Kebaktian I : 07:00", "Kebaktian II : 10:00", "Kebaktian III : 17:00", "Ibadah Anak : Minggu, 10:00", "Ibadah Remaja : Minggu, 10:00", "Ibadah Pemuda : Minggu, 10:00"];
    }
    return []; 
};

const populateEventsForDate = (dateKey: string, date: Date, allUniqueSessions: Set<string>): string[] => {
    const defaultEventsForDay = getAvailableSessionNames(date);
    const combinedEvents = [...defaultEventsForDay];
    
    allUniqueSessions.forEach(session => {
        if (!combinedEvents.includes(session)) {
            combinedEvents.push(session);
        }
    });
    
    const finalEvents = [
        "KESELURUHAN DATA HARI INI",
        ...combinedEvents.sort()
    ].filter((v, i, a) => a.indexOf(v) === i); 

    return finalEvents;
};

// MODIFIED: Fungsi ini kini menerima actualAttendanceDates untuk memfilter tanggal.
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
    
    // HANYA proses tanggal yang memiliki data kehadiran aktual
    if (attendanceSet.has(dayKey)) {
      const currentEventList = currentEvents[dayKey] ?? [];
      
      // HANYA masukkan jika eventlist memiliki isi (setelah inisialisasi)
      if (currentEventList.length > 0) {
           dates.push({ date, key: dayKey, events: currentEventList });
      }
    }
  }
  return dates; 
};

/**
 * FIX: Fungsi untuk mendapatkan tanggal hari tertentu berikutnya
 */
const getNextDayOfWeek = (fromDate: Date, targetDayOfWeek: number): Date => {
    const result = new Date(fromDate.getTime());
    const currentDay = result.getDay();
    let daysToAdd = targetDayOfWeek - currentDay;
    
    if (daysToAdd <= 0) {
        daysToAdd += 7;
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
};

/**
 * FIX: Fungsi untuk generate tanggal berulang berdasarkan periode
 * Perbaikan utama: Logika perhitungan end date dan iterasi mingguan
 */
const generateDatesForPeriod = (startDayKey: string, dayOfWeek: number, period: string): string[] => {
    const dates: string[] = [];
    const baseDate = new Date(startDayKey);
    
    if (isNaN(baseDate.getTime())) {
        console.error("Invalid startDayKey:", startDayKey);
        return [];
    }
    
    // 1. Hitung tanggal akhir berdasarkan periode
    const endDate = new Date(baseDate.getTime());
    
    if (period === '10y') {
        endDate.setFullYear(endDate.getFullYear() + 10);
    } else {
        const match = period.match(/^(\d+)([my])$/);
        if (!match) {
            console.error("Invalid period format:", period);
            return [];
        }
        
        const duration = parseInt(match[1], 10);
        const unit = match[2];
        
        if (unit === 'm') {
            endDate.setMonth(endDate.getMonth() + duration);
        } else if (unit === 'y') {
            endDate.setFullYear(endDate.getFullYear() + duration);
        }
    }
    
    // Safety: maksimal 10 tahun ke depan
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    if (endDate.getTime() > maxDate.getTime()) {
        endDate.setTime(maxDate.getTime());
    }
    
    // 2. Mulai dari hari setelah baseDate
    let currentDate = new Date(baseDate.getTime());
    currentDate.setDate(currentDate.getDate() + 1);
    
    // 3. Cari kemunculan pertama dari dayOfWeek yang diminta
    currentDate = getNextDayOfWeek(currentDate, dayOfWeek);
    
    // 4. Loop untuk mengumpulkan semua tanggal yang valid
    const todayTime = new Date().setHours(0, 0, 0, 0);
    
    while (currentDate.getTime() <= endDate.getTime()) {
        // Hanya tambahkan tanggal yang di masa depan (lebih dari hari ini)
        if (currentDate.getTime() > todayTime) {
            const dayKey = getDayKey(currentDate);
            dates.push(dayKey);
        }
        
        // Pindah ke minggu berikutnya (7 hari)
        currentDate.setDate(currentDate.getDate() + 7);
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

// --- LOGIKA KALENDER ---
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

    // --- NEW RESPONSIVE LOGIC ---
    const [isMobileView, setIsMobileView] = useState(false);
    
    useEffect(() => {
        const checkScreenSize = () => {
            // Tailwind's 'md' breakpoint is typically 768px
            if (typeof window !== 'undefined') {
                 setIsMobileView(window.innerWidth < 768);
            }
        };
        
        // Initial check
        checkScreenSize();
        
        // Add event listener
        window.addEventListener('resize', checkScreenSize);
        
        // Cleanup
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);
    // --- END NEW RESPONSIVE LOGIC ---

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
        // Menampilkan 1 bulan di HP (isMobileView), 3 bulan di Desktop
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
                        
                        const hasAttendanceData = attendanceSet.has(dayKey); 
                        
                        let dayClass = "relative p-1.5 rounded-full transition-all duration-150 text-xs md:text-sm";
                        
                        // MODIFIED: Hanya blokir tanggal masa depan.
                        if (isFutureDay) { 
                          dayClass += " text-gray-300 cursor-not-allowed";
                        } else if (isSelected) {
                          // Tetap tampilkan warna biru jika terpilih
                          dayClass += " bg-indigo-600 text-white font-bold cursor-pointer shadow-md"; 
                        } else { 
                          // Mengizinkan klik di semua tanggal yang sudah lewat
                          dayClass += " text-gray-700 hover:bg-indigo-200 cursor-pointer";
                        }

                        return (
                          <div 
                            key={i} 
                            className={dayClass} 
                            // MODIFIED: Panggil handler selama bukan tanggal masa depan
                            onClick={() => !isFutureDay && handleSelectDate(day, monthIndex)} 
                            role="button"
                          >
                            {day}
                            {/* Titik hanya muncul jika ADA data kehadiran */}
                            {hasAttendanceData && !isSelected && ( 
                              <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600`}></div>
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

// --- LOGIKA DAFTAR EVENT ---
interface SelectedEventsSectionProps {
    selectedDates: Date[];
    selectedEventsByDate: SelectedEventsByDate;
    events: EventsCache;
    viewMode: ViewMode;
    handleSelectEvent: (dateKey: string, event: string) => void;
    handleDeleteEvent: (dateKey: string, eventName: string) => void;
    handleOpenEditEvent: (dateKey: string, eventName: string) => void;
    handleOpenAddEvent: (dateKey: string) => void; 
}

const SelectedEventsSection = ({
    selectedDates, selectedEventsByDate, events, viewMode,
    handleSelectEvent, handleDeleteEvent, handleOpenEditEvent,
    handleOpenAddEvent 
}: SelectedEventsSectionProps) => {
    
    const selectedDateKeys = useMemo(() => selectedDates.map(getDayKey), [selectedDates]);

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
                        <button 
                          className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition" 
                          onClick={() => handleOpenAddEvent(key)}
                        >
                          + Event
                        </button>
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

                                return (
                                <div key={ev+idx} className="relative inline-block">
                                    <button
                                        onClick={() => handleSelectEvent(key, ev)} 
                                        className={`text-xs px-3 py-1.5 rounded-lg transition text-left
                                          ${isOverall 
                                            ? isSelected 
                                              ? 'bg-green-600 text-white' 
                                              : 'border-2 border-green-300 text-green-700 hover:bg-green-100'
                                            : isSelected
                                              ? 'bg-indigo-600 text-white' 
                                              : 'border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                                          }`}
                                    >
                                        {ev}
                                    </button>
                                    
                                    {!isOverall && (
                                        <>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    handleOpenEditEvent(key, ev);
                                                }}
                                                className="absolute top-[-8px] left-[-8px] bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] p-0 leading-none hover:bg-blue-700 transition" 
                                                title="Edit Event"
                                            >
                                                <Pencil size={8} />
                                            </button>
                                            
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    handleDeleteEvent(key, ev);
                                                }}
                                                className="absolute top-[-8px] right-[-8px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] p-0 leading-none hover:bg-red-700 transition" 
                                                title="Hapus Event"
                                            >
                                                <X size={10} />
                                            </button>
                                        </>
                                    )}
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

// Komponen Modal Kustom untuk Konfirmasi/Alert
const ConfirmationModal = ({ data }: { data: CustomConfirmation | null }) => {
    if (!data || !data.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                <div className="p-6">
                    <h3 className={`text-xl font-bold mb-4 ${data.showCancelButton ? 'text-red-700' : 'text-indigo-700'}`}>
                        {data.title}
                    </h3>
                    <p className="text-gray-700 mb-6">{data.message}</p>
                    <div className="flex justify-end gap-3">
                        {data.showCancelButton && (
                            <button
                                onClick={data.onCancel}
                                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                                Batal
                            </button>
                        )}
                        <button
                            onClick={data.onConfirm}
                            className={`px-4 py-2 text-white rounded-lg transition ${
                                data.showCancelButton ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            Oke
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- KOMPONEN UTAMA ---
export default function DatabasePage() {
  const router = useRouter();
  useEffect(() => {
    const checkRole = async () => {
      const res = await fetch("/api/me");
      const data = (await res.json()) as { role?: "admin" | "user" }; 
      if (data.role !== "admin") {
        void router.push("/unauthorized"); 
      }
    };
    void checkRole();
  }, [router]);
  
  // NEW STATE: Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>((currentMonth - 1 + 12) % 12);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(Math.floor(currentYear / 10) * 10);
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<SelectedEventsByDate>({});
  const [events, setEvents] = useState<EventsCache>(() => memoryStorage.events || {});
  const [actualAttendanceDates, setActualAttendanceDates] = useState<string[]>([]); // NEW STATE
  const [viewMode, setViewMode] = useState<ViewMode>('event_per_table');
  
  const [confirmationModal, setConfirmationModal] = useState<CustomConfirmation | null>(null);

  const showConfirmation = useCallback((title: string, message: string, onConfirm: () => void, showCancelButton: boolean = false, onCancel: () => void = () => setConfirmationModal(null)) => {
      setConfirmationModal({ isOpen: true, title, message, onConfirm, onCancel, showCancelButton });
  }, []);

  const showAlert = useCallback((title: string, message: string) => {
      // PERUBAHAN: Menghilangkan pop-up notifikasi
      console.log(`Alert suppressed: ${title} - ${message}`);
  }, []);

  
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalData, setEventModalData] = useState<Partial<EventModalData>>({
      type: 'add-single', 
      dateKey: null,
      newName: '',
      oldName: null,
      periodicalDayOfWeek: 0,
      periodicalPeriod: '2m',
  });

  const updateEventModalData = (newData: Partial<EventModalData>) => {
      setEventModalData(prev => ({ ...prev, ...newData }));
  };

  const [tablePage, setTablePage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [draftJemaat, setDraftJemaat] = useState<Jemaat[]>([]);
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false);
  const [formData, setFormData] = useState<Jemaat | null>(null);
  const itemsPerPage = 10;
  
  const [filterStatusKehadiran, setFilterStatusKehadiran] = useState(""); 
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiranSesi, setFilterKehadiranSesi] = useState(""); 
  
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewModalData, setPreviewModalData] = useState<PreviewModalData | null>(null);
  
  const selectedDatesOnly = useMemo(() => selectedDates.map(getDayKey), [selectedDates]); 
  
  const localPreviewUrl = useMemo(() => {
    if (selectedFile && isImageUrlOrBase64(selectedFile.name)) {
        return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

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
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat"); 
        
        if (!res.ok) {
          throw new Error(`Gagal fetch data jemaat. Status: ${res.status}`);
        }

        const data: unknown = await res.json();
        
        const apiResponse = data as { jemaatData: Jemaat[], attendanceDates: string[] };

        if (Array.isArray(apiResponse.jemaatData) && apiResponse.jemaatData.length > 0) {
          const fetchedJemaat = apiResponse.jemaatData;
          setJemaat(fetchedJemaat);
          setDraftJemaat(fetchedJemaat.map(j => ({ ...j })));
          
          const fetchedAttendanceDates = apiResponse.attendanceDates;
          setActualAttendanceDates(fetchedAttendanceDates); 
          
          const allUniqueSessions = new Set<string>();
          fetchedJemaat.forEach(j => {
              if (j.kehadiranSesi) {
                  allUniqueSessions.add(j.kehadiranSesi);
              }
          });
          
          const newEvents: EventsCache = {};
          
          fetchedAttendanceDates.forEach(dateKey => {
              const date = new Date(dateKey);
              
              if (!memoryStorage.events[dateKey]) {
                  const finalEvents = populateEventsForDate(dateKey, date, allUniqueSessions);
                  if (finalEvents.length > 0) {
                      newEvents[dateKey] = finalEvents;
                  }
              }
          });
          
          const mergedEvents = { ...memoryStorage.events, ...newEvents };
          setEvents(mergedEvents);
          memoryStorage.events = mergedEvents;
          
        } else {
          setJemaat([]);
          setDraftJemaat([]);
          setActualAttendanceDates([]); 
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
        setJemaat([]); 
        setDraftJemaat([]);
        setActualAttendanceDates([]); 
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []); 

  useEffect(() => {
    const newEvents: EventsCache = {};
    // Logic untuk menentukan berapa bulan yang harus diinisialisasi
    const count = window.innerWidth < 768 ? 1 : 3; 
    const months = [];
    for (let i = 0; i < count; i++) {
      const monthIndex = (startMonth + i) % 12;
      months.push(monthIndex);
    }
    
    months.forEach(month => {
        const datesInMonth = getDatesWithEventsInMonth(month, year, memoryStorage.events, actualAttendanceDates); 
        datesInMonth.forEach(d => {
            if (!memoryStorage.events[d.key]) { 
                const allUniqueSessions = new Set(jemaat.map(j => j.kehadiranSesi));
                newEvents[d.key] = populateEventsForDate(d.key, d.date, allUniqueSessions);
            }
        });
    });
    
    if (Object.keys(newEvents).length > 0) {
      setEvents(prev => ({ ...prev, ...newEvents }));
    }
  }, [startMonth, year, actualAttendanceDates, jemaat]); 

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
    
    datesWithEventsInMonth.forEach(d => {
        const overallEvent = d.events.find(e => e === "KESELURUHAN DATA HARI INI");
        newEventsByDate[d.key] = overallEvent ? [overallEvent] : [];
        memoryStorage.events[d.key] ??= d.events; 
    });
    
    setEvents(prev => ({ ...prev, ...memoryStorage.events }));
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
    
    setStartMonth(monthIndex);
    setYear(currentYear);
    setViewMode('monthly_summary');
  }, [viewMode, startMonth, year, setStartMonth, setYear, actualAttendanceDates]); 

   useEffect(() => {
    if (!router.isReady || isLoading || jemaat.length === 0 || actualAttendanceDates.length === 0) return; 

    const { dates, date, mode, event: eventQuery } = router.query;
    
    const currentEventsCache = memoryStorage.events;
    
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
            
            const availableEvents = currentEventsCache[dateKey];
            if (!availableEvents) return;

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
        
        const availableEvents = currentEventsCache[dateKey];
        if (!availableEvents) return;

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
    
  }, [router, isLoading, jemaat.length, handleSelectMonth, actualAttendanceDates]); 

  // MODIFIED: Fungsi handleSelectDate yang sudah diperbarui (menghilangkan showAlert)
  const handleSelectDate = useCallback((day: number, month: number) => {
    setViewMode('event_per_table'); 
    
    const clickedDate = new Date(year, month, day);
    const key = getDayKey(clickedDate);
    const dateTimestamp = new Date(clickedDate).setHours(0, 0, 0, 0);
    const isFuture = dateTimestamp > todayStart;
    
    if (isFuture) { 
        return;
    }

    const hasAttendance = actualAttendanceDates.includes(key);
    const isCurrentlySelected = selectedDates.some(d => getDayKey(d) === key);
    
    // --- START LOGIKA BARU: Handle Select/Deselect tanpa data ---
    // 1. Jika tidak ada data dan tanggal sedang TIDAK terpilih, tetap izinkan selection state berubah (select)
    if (!hasAttendance && !isCurrentlySelected) {
        // Jika tidak ada data, kita perlu memastikan event list kosong di cache jika belum ada
        if (!events[key]) {
             setEvents(prev => ({ ...prev, [key]: [] }));
             memoryStorage.events[key] = [];
        }
    }
    
    // 2. Jika tidak ada data dan tanggal sedang TERPILIH, izinkan deselect normal
    // 3. Jika ada data, buat event list normal

    // Handle Event Caching/Generation (Hanya untuk tanggal dengan data, atau tanggal yang dipilih tanpa data)
    let currentEvents = events[key];
    if (hasAttendance && !currentEvents) {
        // Generate defaults if data exists but cache is empty
        const allUniqueSessions = new Set(jemaat.map(j => j.kehadiranSesi));
        currentEvents = populateEventsForDate(key, clickedDate, allUniqueSessions);
        setEvents(prev => ({ ...prev, [key]: currentEvents }));
        memoryStorage.events[key] = currentEvents;
    } else if (!hasAttendance && isCurrentlySelected) {
        // Jika sedang deselect tanggal tanpa data, currentEvents mungkin undefined, biarkan saja.
    }

    let newDates: Date[];
    const newEventsByDate = { ...selectedEventsByDate };

    if (isCurrentlySelected) {
      // DESELECT
      newDates = selectedDates.filter(d => getDayKey(d) !== key);
      delete newEventsByDate[key];
    } else {
      // SELECT
      newDates = [...selectedDates, clickedDate].sort((a, b) => a.getTime() - b.getTime());
      
      const eventsList = events[key] ?? []; // Use final list, which might be []
      const overallEvent = eventsList.find(e => e === "KESELURUHAN DATA HARI INI");
      
      // Select the overall event ONLY IF it exists (which implies hasAttendance)
      // Jika hasAttendance false, selected events akan [] sehingga tabel utama kosong.
      newEventsByDate[key] = overallEvent ? [overallEvent] : []; 
    }
    
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
  }, [events, selectedDates, selectedEventsByDate, year, jemaat, actualAttendanceDates]); // Removed showAlert

  const handleSelectEvent = useCallback((dateKey: string, event: string) => {
    setViewMode('event_per_table'); 
    
    setSelectedEventsByDate(prev => {
      const current = prev[dateKey] ?? [];
      const isEventSelected = current.includes(event);
      
      let updated: string[];
      
      if (event === "KESELURUHAN DATA HARI INI") {
          if (isEventSelected) {
              updated = current.filter(e => e !== event); 
          } else {
              updated = [event];
          }
      } else {
          if (isEventSelected) {
              updated = current.filter((e: string) => e !== event);
          } else {
              updated = [...current.filter(e => e !== "KESELURUHAN DATA HARI INI"), event];
          }
      }
      
      const newEventsByDate = { ...prev, [dateKey]: updated.filter(e => e) };
      saveSelection(selectedDates, newEventsByDate);

      return newEventsByDate;
    });
  }, [selectedDates]);
  
  const handleOpenAddEvent = useCallback((dateKey: string) => {
    // Check if the date has attendance data
    if (!actualAttendanceDates.includes(dateKey)) {
        // PERUBAHAN: Menghilangkan pop-up notifikasi
        return; 
    }

      setEventModalData({
          type: 'flow-select', 
          dateKey,
          newName: '',
          oldName: null,
          periodicalDayOfWeek: new Date(dateKey).getDay(), 
          periodicalPeriod: '2m',
      });
      
      setShowEventModal(true);
  }, [actualAttendanceDates, showAlert]);

  const handleSingleAddEvent = useCallback(() => {
    const key = eventModalData.dateKey;
    const newName = eventModalData.newName?.trim();

    if (!key || !newName) return;
    
    setViewMode('event_per_table');
    
    const currentEvents = events[key] ?? [];
    const lowerNewName = newName.toLowerCase();
    
    if (currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === lowerNewName)) {
         showAlert("Duplikasi Event", `Event "${newName}" sudah ada di tanggal ini.`);
         return;
    }

    const newEvents = [
        "KESELURUHAN DATA HARI INI", 
        ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI" && e !== newName), 
        newName
    ];
    
    setEvents(prevEvents => {
      const updatedEvents = { ...prevEvents, [key]: newEvents };
      memoryStorage.events = updatedEvents;
      return updatedEvents;
    });
    
    setSelectedEventsByDate(prev => {
      const currentSelected = prev[key] ?? [];
      const newSelected = [...currentSelected, newName];
      const newEventsByDate = { ...prev, [key]: newSelected.filter(e => e) };
      saveSelection(selectedDates, newEventsByDate);
      return newEventsByDate;
    });
    
    if (!selectedDates.some(d => getDayKey(d) === key)) {
      setSelectedDates(prev => [...prev, new Date(key)].sort((a, b) => a.getTime() - b.getTime()));
    }
    
    setShowEventModal(false);
    setEventModalData({}); 
    showAlert("Sukses", `Event "${newName}" berhasil ditambahkan.`);
  }, [eventModalData, events, selectedDates, showAlert]);

  const handlePeriodicalAddEvent = useCallback(() => {
    const { periodicalDayOfWeek, periodicalPeriod, newName, dateKey } = eventModalData;
    const eventName = newName?.trim();
    const dayOfWeek = periodicalDayOfWeek !== null ? periodicalDayOfWeek : new Date(dateKey ?? '').getDay();

    if (!eventName || dayOfWeek === null || !dateKey || !periodicalPeriod) {
        showAlert("Data Tidak Lengkap", "Pastikan semua field telah diisi dengan benar.");
        return;
    }
    
    setViewMode('event_per_table');
    
    const allUniqueSessions = new Set(jemaat.map(j => j.kehadiranSesi));
    const lowerNewName = eventName.toLowerCase();
    let totalUpdatedCount = 0;

    // 1. Generate semua tanggal berulang
    const futureDates = generateDatesForPeriod(dateKey, dayOfWeek, periodicalPeriod);
    
    // 2. Update events state dengan semua tanggal sekaligus
    setEvents(prevEvents => {
        const updatedEvents = { ...prevEvents };
        
        // Tambahkan/update event di tanggal awal (dateKey)
        const startDateEvents = updatedEvents[dateKey] ?? populateEventsForDate(dateKey, new Date(dateKey), allUniqueSessions);
        const isDuplicateOnStart = startDateEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === lowerNewName);
        
        if (!isDuplicateOnStart) {
            updatedEvents[dateKey] = [
                "KESELURUHAN DATA HARI INI", 
                ...startDateEvents.filter(e => e !== "KESELURUHAN DATA HARI INI"), 
                eventName
            ].filter((v, i, a) => a.indexOf(v) === i);
            totalUpdatedCount++;
        } else {
            // Update case variant jika sudah ada
            updatedEvents[dateKey] = [
                "KESELURUHAN DATA HARI INI", 
                ...startDateEvents.filter(e => e !== "KESELURUHAN DATA HARI INI" && e.toLowerCase() !== lowerNewName), 
                eventName
            ].filter((v, i, a) => a.indexOf(v) === i);
            totalUpdatedCount++;
        }
        
        // Tambahkan event ke semua tanggal berulang masa depan
        futureDates.forEach(key => {
            const date = new Date(key);
            const initialEvents = populateEventsForDate(key, date, allUniqueSessions);
            const currentEvents = updatedEvents[key] ?? initialEvents;
            
            // Cek apakah event sudah ada (case-insensitive)
            const alreadyExists = currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === lowerNewName);
            
            if (!alreadyExists) {
                updatedEvents[key] = [
                    "KESELURUHAN DATA HARI INI", 
                    ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI"), 
                    eventName
                ].filter((v, i, a) => a.indexOf(v) === i);
                totalUpdatedCount++;
            }
        });

        memoryStorage.events = updatedEvents;
        return updatedEvents;
    });

    if (totalUpdatedCount > 0) {
        const periodLabel = PERIOD_OPTIONS.find(p => p.value === periodicalPeriod)?.label ?? 'periode yang dipilih';
        const numPeriodicAdded = totalUpdatedCount - 1; // Kurangi 1 untuk tanggal awal

        showAlert(
            "Sukses Penambahan Berkala", 
            `Event "${eventName}" berhasil ditambahkan ke ${totalUpdatedCount} tanggal! (1 tanggal awal + ${numPeriodicAdded} tanggal berulang hingga ${periodLabel})`
        );
        
        // Pastikan tanggal awal dipilih
        if (!selectedDates.some(d => getDayKey(d) === dateKey)) {
             setSelectedDates(prev => [...prev, new Date(dateKey)].sort((a, b) => a.getTime() - b.getTime()));
        }
        
        // Tambahkan event ke selectedEventsByDate untuk tanggal awal
        setSelectedEventsByDate(prev => {
            const currentSelected = prev[dateKey] ?? [];
            const newSelected = [...currentSelected.filter(e => e.toLowerCase() !== lowerNewName), eventName];
            const newEventsByDate = { ...prev, [dateKey]: newSelected.filter(e => e) };
            saveSelection(selectedDates, newEventsByDate);
            return newEventsByDate;
        });

    } else {
         showAlert("Informasi", `Event "${eventName}" sudah ada di semua tanggal yang dipilih.`);
    }

    setShowEventModal(false);
    setEventModalData({});
  }, [eventModalData, events, selectedDates, jemaat, showAlert]);

  const handleEventAction = useCallback(() => {
    switch(eventModalData.type) {
        case 'add-single':
            handleSingleAddEvent();
            break;
        case 'add-periodical':
            handlePeriodicalAddEvent();
            break;
        case 'edit-single':
            const { dateKey: key, oldName, newName: newN } = eventModalData;
            const newNameTrim = newN?.trim();
            if (!key || !oldName || !newNameTrim || oldName === newNameTrim) {
                setShowEventModal(false);
                return;
            }
            
            setEvents(prevEvents => {
                const currentEvents = prevEvents[key] ?? [];
                const oldIndex = currentEvents.findIndex(e => e.toLowerCase() === oldName.toLowerCase());
                
                if (oldIndex === -1) return prevEvents; 
                
                const updatedEvents = [...currentEvents];
                updatedEvents[oldIndex] = newNameTrim;
                
                memoryStorage.events = { ...prevEvents, [key]: updatedEvents };
                return { ...prevEvents, [key]: updatedEvents };
            });
            
            setSelectedEventsByDate(prevSelected => {
                const currentSelected = prevSelected[key] ?? [];
                const updatedSelected = currentSelected.map(e => (e === oldName ? newNameTrim : e));
                
                saveSelection(selectedDates, { ...prevSelected, [key]: updatedSelected });
                return { ...prevSelected, [key]: updatedSelected };
            });
            
            setShowEventModal(false);
            setEventModalData({});
            showAlert("Sukses Edit Satuan", `Event berhasil diubah dari "${oldName}" menjadi "${newNameTrim}" pada tanggal ${new Date(key!).toLocaleDateString("id-ID")}.`);
            break;
        case 'edit-periodical-confirm':
            const { dateKey: startKey, oldName: nameToChange, newName: newNPeriodic } = eventModalData;
            const isDeletion = !newNPeriodic || newNPeriodic.trim() === ''; 
            const newNamePeriodic = newNPeriodic?.trim() ?? '';
            
            if (!startKey || !nameToChange || (!isDeletion && !newNamePeriodic)) {
                setShowEventModal(false);
                return;
            }

            const lowerNameChange = nameToChange.toLowerCase();
            let totalPeriodicAffected = 0;

            setEvents(prevEvents => {
                const updatedEvents = { ...prevEvents };
                const startDate = new Date(startKey).setHours(0, 0, 0, 0);
                
                Object.keys(updatedEvents).forEach(key => {
                    const currentDate = new Date(key).setHours(0, 0, 0, 0);
                    if (currentDate >= startDate) {
                        let eventsList = updatedEvents[key] ?? [];
                        
                        const targetEventIndex = eventsList.findIndex(e => e.toLowerCase() === lowerNameChange);
                        
                        if (targetEventIndex !== -1) {
                            if (isDeletion) {
                                eventsList.splice(targetEventIndex, 1);
                                totalPeriodicAffected++;
                            } else {
                                eventsList[targetEventIndex] = newNamePeriodic;
                                totalPeriodicAffected++;
                            }
                            updatedEvents[key] = eventsList.filter((v, i, a) => a.indexOf(v) === i); 
                        }
                    }
                });

                memoryStorage.events = updatedEvents;
                return updatedEvents;
            });
            
             setSelectedEventsByDate(prevSelected => {
                const updatedSelected = { ...prevSelected };
                const startDate = new Date(startKey).setHours(0, 0, 0, 0);

                Object.keys(updatedSelected).forEach(key => {
                    const currentDate = new Date(key).setHours(0, 0, 0, 0);

                    if (currentDate >= startDate) {
                         let selectedList = updatedSelected[key] ?? [];
                         const targetSelectedEventIndex = selectedList.findIndex(e => e.toLowerCase() === lowerNameChange);
                         
                         if(targetSelectedEventIndex !== -1) {
                             if (isDeletion) {
                                selectedList.splice(targetSelectedEventIndex, 1);
                             } else {
                                selectedList[targetSelectedEventIndex] = newNamePeriodic;
                             }
                             updatedSelected[key] = selectedList.filter((v, i, a) => a.indexOf(v) === i);
                         }
                    }
                });
                
                saveSelection(selectedDates, updatedSelected);
                return updatedSelected;
            });

            const actionVerb = isDeletion ? 'dihapus' : 'diperbarui';
            showAlert("Sukses Aksi Berkala", `${totalPeriodicAffected} kejadian Event "${nameToChange}" telah ${actionVerb} mulai dari ${new Date(startKey).toLocaleDateString("id-ID")} dan semua tanggal setelahnya.`);
            setShowEventModal(false);
            setEventModalData({});
            break;
        case 'flow-select':
            break;
        default:
            break;
    }
  }, [eventModalData, handleSingleAddEvent, handlePeriodicalAddEvent, events, selectedDates, jemaat, showAlert]);

  const handleDeleteEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return; 
      
      const onConfirm = () => {
          setEvents(prevEvents => {
              const updatedEvents = {
                  ...prevEvents,
                  [dateKey]: (prevEvents[dateKey] ?? []).filter(e => e !== eventName)
              };
              memoryStorage.events = updatedEvents;
              return updatedEvents;
          });
          
          setSelectedEventsByDate(prevSelected => {
              const newSelected = {
                  ...prevSelected,
                  [dateKey]: (prevSelected[dateKey] ?? []).filter(e => e !== eventName)
              };
              saveSelection(selectedDates, newSelected);
              return newSelected;
          });
          setConfirmationModal(null);
      };
      
      const onCancel = () => {
          setEventModalData({
              type: 'edit-periodical-confirm',
              dateKey,
              oldName: eventName,
              newName: '',
              periodicalDayOfWeek: null,
              periodicalPeriod: '',
          });
          setShowEventModal(true);
          setConfirmationModal(null);
      }

      showConfirmation(
          "Konfirmasi Penghapusan",
          `Event "${eventName}" mungkin berulang. Apakah Anda ingin menghapus HANYA untuk tanggal ini? (Pilih 'Batal' untuk menghapus semua event masa depan yang namanya sama).`,
          onConfirm,
          true,
          onCancel
      );
      
  }, [selectedDates, showConfirmation]);

  const handleOpenEditEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return;
      
      const onConfirm = () => {
          setEventModalData({
              type: 'edit-periodical-confirm',
              dateKey,
              oldName: eventName,
              newName: eventName, 
              periodicalDayOfWeek: null,
              periodicalPeriod: '',
          });
          setShowEventModal(true);
          setConfirmationModal(null);
      }
      
      const onCancel = () => {
          setEventModalData({ 
            type: 'edit-single', 
            dateKey, 
            oldName: eventName, 
            newName: eventName,
            periodicalDayOfWeek: null,
            periodicalPeriod: '2m',
          });
          setShowEventModal(true);
          setConfirmationModal(null);
      }

      showConfirmation(
          "Konfirmasi Pengeditan",
          `Event "${eventName}" mungkin berulang. Apakah Anda ingin mengedit nama event ini untuk SEMUA tanggal yang akan datang? (Pilih 'Batal' untuk mengedit HANYA tanggal ini).`,
          onConfirm,
          true,
          onCancel
      );
      
  }, [showConfirmation]);

  const handleSaveEdit = useCallback(() => {
    setEditMode(false);
    setJemaat(draftJemaat.map(d => ({ ...d })));
  }, [draftJemaat]);
  
  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setDraftJemaat(jemaat.map(j => ({ ...j })));
  }, [jemaat]);
  
  const handleSelectYearFromGrid = useCallback((selectedYear: number) => {
    setYear(selectedYear);
    setShowYearDialog(false);
  }, []);
  
  const calculatedAge = useMemo(() => {
    return calculateAge(formData?.tanggalLahir);
  }, [formData?.tanggalLahir]);
  
  const getFilteredJemaatPerEvent = useCallback((jemaatList: Jemaat[], dateKey: string, event: string): Jemaat[] => {
      
    // STEP 1: Filter KETAT - hanya jemaat yang tanggalKehadirannya PERSIS SAMA dengan dateKey
    let filteredByDate = jemaatList.filter(j => {
      // Pastikan tanggalKehadiran ada dan sama persis dengan dateKey
      if (!j.tanggalKehadiran) return false;
      
      // Normalisasi format tanggal untuk perbandingan
      const jemaatDate = j.tanggalKehadiran.split('T')[0]; // Ambil bagian YYYY-MM-DD saja
      const targetDate = dateKey.split('T')[0];
      
      return jemaatDate === targetDate;
    });
    
    // Jika tidak ada data untuk tanggal ini, return empty array
    if (filteredByDate.length === 0) {
      return [];
    }
    
    // STEP 2: Filter berdasarkan status kehadiran dan jabatan
    let filteredData = filteredByDate.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan)
    );
    
    if (event === "KESELURUHAN BULAN INI") {
        if (filterKehadiranSesi !== "") {
            filteredData = filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        return filteredData;
    }
    
    if (event === "KESELURUHAN DATA HARI INI") {
        // Untuk keseluruhan data hari ini, tampilkan semua jemaat yang hadir di tanggal ini
        if (filterKehadiranSesi !== "") {
            return filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        return filteredData; 
    }
    
    // Filter berdasarkan sesi spesifik
    return filteredData.filter(j => j.kehadiranSesi === event);
  }, [filterStatusKehadiran, filterJabatan, filterKehadiranSesi]);

  const getFilteredJemaatMonthlySummary = useCallback((jemaatList: Jemaat[]): Jemaat[] => {
    if (selectedDatesOnly.length === 0) return [];

    let filteredData = jemaatList.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan)
    );
    
    if (filterKehadiranSesi !== "") {
        filteredData = filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
    }

    return filteredData;
  }, [selectedDatesOnly.length, filterStatusKehadiran, filterJabatan, filterKehadiranSesi]);
  
  const getFilteredJemaat = useCallback((jemaatList: Jemaat[]): Jemaat[] => {
    if (viewMode === 'monthly_summary') {
        return getFilteredJemaatMonthlySummary(jemaatList);
    }
    
    if (selectedTables.length > 0) {
        return selectedTables[0]
          ? getFilteredJemaatPerEvent(jemaatList, selectedTables[0].date, selectedTables[0].event)
          : [];
    }

    return [];
  }, [viewMode, selectedTables, getFilteredJemaatMonthlySummary, getFilteredJemaatPerEvent]);
  
  const dataForPagination = useMemo(() => getFilteredJemaat(jemaat), [jemaat, getFilteredJemaat]);
  const filteredCount = dataForPagination.length;
  const totalPages = Math.ceil(filteredCount / itemsPerPage);
  
  const getPagedData = useCallback((jemaatList: Jemaat[]) => {
    const filtered = jemaatList; 
    const indexOfLast = tablePage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return filtered.slice(indexOfFirst, indexOfLast);
  }, [tablePage]);
  
  const uniqueJabatan = useMemo(() => 
    [...new Set(jemaat.map((j) => j.jabatan))], [jemaat]);
    
  const uniqueKehadiranSesiByDate = useMemo(() => {
    const allUniqueSessions = Array.from(new Set(jemaat.map((j) => j.kehadiranSesi)));

    if (selectedTables.length === 0 || viewMode === 'monthly_summary') {
        return allUniqueSessions;
    }
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return allUniqueSessions.sort();
    } 
    
    if (selectedTables.length > 0 && selectedTables[0]) {
        return [selectedTables[0].event];
    }
    
    return allUniqueSessions.sort();
  }, [jemaat, selectedTables, viewMode]);

  const handleRowClick = useCallback((row: Jemaat) => {
    if (!editMode) {
      setFormData({ ...row });
      setOpenDetailDrawer(true);
      setSelectedFile(null); 
    }
  }, [editMode]);
  
  const handleSaveForm = useCallback(() => {
    if (formData) {
        const updatedFormData = { ...formData };
        
        if (updatedFormData.tanggalLahir) {
            updatedFormData.umur = calculateAge(updatedFormData.tanggalLahir);
        } else {
            updatedFormData.umur = undefined;
        }

        setJemaat(prev => prev.map(j => j.id === updatedFormData.id ? updatedFormData : j));
        setDraftJemaat(prev => prev.map(j => j.id === updatedFormData.id ? updatedFormData : j));
        setOpenDetailDrawer(false);
        setSelectedFile(null); 
    }
  }, [formData]);
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files ? event.target.files[0] : null;
      setSelectedFile(file ?? null);
      if (file) {
          setFormData(f => f ? { ...f, dokumen: undefined } : null);
      }
  }, []);
  
  const handleFileUpload = useCallback(async () => {
      if (!selectedFile || !formData) return;

      setIsUploading(true);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
          let savedDocumentData: string | undefined;

          if (selectedFile.type.includes('image')) {
              const reader = new FileReader();
              reader.readAsDataURL(selectedFile);
              
              const base64Data = await new Promise<string>((resolve, reject) => {
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = error => reject(new Error(`FileReader error: ${error.target?.error?.message ?? 'Unknown error'}`));
              });
              savedDocumentData = base64Data;
              
          } else if (selectedFile.type.includes('pdf')) {
              savedDocumentData = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?file=${selectedFile.name}_${Math.random().toString(36).substring(2, 8)}`;
          } else {
              savedDocumentData = `https://example.com/docs/file?name=${selectedFile.name}_${Math.random().toString(36).substring(2, 8)}`;
          }
          
          setFormData(f => f ? { ...f, dokumen: savedDocumentData } : null);
          showAlert("Sukses Upload", `Dokumen "${selectedFile.name}" berhasil diunggah dan disimpan (Simulasi)!`);
      } catch (error) {
          console.error("Error mock uploading file:", error);
          showAlert("Gagal Upload", "Gagal mengunggah dokumen (Mock Error).");
      } finally {
          setIsUploading(false);
          setSelectedFile(null); 
      }
  }, [selectedFile, formData, showAlert]);
  
  const openPreviewModal = useCallback((jemaatItem: Jemaat) => {
    if (!jemaatItem.dokumen) return;

    let type: PreviewModalData['type'];
    if (isImageUrlOrBase64(jemaatItem.dokumen)) {
        type = 'image';
    } else if (jemaatItem.dokumen.includes('.pdf') || jemaatItem.dokumen.startsWith('data:application/pdf')) {
        type = 'pdf';
    } else {
        type = 'other';
    }
    
    setPreviewModalData({
        url: jemaatItem.dokumen,
        name: `${jemaatItem.nama}'s Document`,
        type: type
    });
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewModalData(null);
  }, []);

  const tablesToRender = useMemo(() => {
    if (viewMode === 'monthly_summary') {
      if (selectedDatesOnly.length === 0) return [];
      return [{ date: getDayKey(new Date(year, startMonth, 1)), event: 'KESELURUHAN BULAN INI' }];
    } else {
      return selectedTables;
    }
  }, [viewMode, selectedTables, selectedDatesOnly.length, startMonth, year]);

  const handleDownload = useCallback(async (format: 'csv' | 'pdf') => {
    if (tablesToRender.length === 0) {
        showAlert("Download Gagal", "Tidak ada data untuk diunduh. Pilih tanggal dan event terlebih dahulu.");
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
          
          const keys: (keyof Jemaat)[] = ['id', 'nama', 'statusKehadiran', 'jabatan', 'kehadiranSesi', 'email', 'telepon'];
          
          tablesToRender.forEach(({ date, event }, tableIndex) => {
            const dataForTable = getFilteredJemaatMonthlySummary(jemaat);
            
            if (dataForTable.length === 0) return;
            
            const tableHeader = viewMode === 'monthly_summary'
              ? `Data Keseluruhan | ${monthNames[startMonth]} ${year}`
              : `${new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${event}`;
            
            csv += `\n"${tableHeader}"\n`;
            csv += `"Total Data: ${dataForTable.length}"\n`;
            
            const headers = ['ID', 'Nama', 'Status Kehadiran', 'Jabatan', 'Jenis Ibadah', 'Email', 'Telp'];
            csv += headers.map(h => `"${h}"`).join(",") + "\n";
            
            csv += dataForTable.map(row => 
              keys.map(key => {
                const val = row[key] ?? '';
                return `"${String(val).replace(/"/g, '""')}"`; 
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
              const dataForTable = getFilteredJemaatMonthlySummary(jemaat);
              
              if (dataForTable.length === 0) return;
              
              if (!isFirstTable) {
                pdf.addPage();
              }
              isFirstTable = false;
              
              let yPosition = 20;
              
              const tableHeader = viewMode === 'monthly_summary'
                ? `Data Keseluruhan | ${monthNames[startMonth]} ${year}`
                : `${new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} - ${event}`;
              
              pdf.setFontSize(14);
              pdf.setFont('helvetica', 'bold');
              pdf.text(tableHeader, margin, yPosition);
              yPosition += 8;
              
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              pdf.text(`Total Data: ${dataForTable.length}`, margin, yPosition);
              yPosition += 10;
              
              const head = [['ID', 'Nama', 'Status', 'Jabatan', 'Jenis Ibadah', 'Telp']];
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
        showAlert("Download Gagal", `Gagal membuat laporan ${format.toUpperCase()}. Periksa konsol untuk detail error.`);
      } finally {
        const finalLoadingDiv = document.getElementById('download-loading');
        if (finalLoadingDiv) {
            document.body.removeChild(finalLoadingDiv);
        }
      }
  }, [tablesToRender, selectedDates, viewMode, startMonth, year, jemaat]);

  const showSesiFilter = useMemo(() => {
    if (viewMode === 'monthly_summary') return true;
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return true;
    }
    
    return false;
  }, [viewMode, selectedTables]);
  
  const getPreviewUrl = useMemo(() => {
    if (selectedFile) {
        if (localPreviewUrl) return localPreviewUrl;
        return null; 
    }
    return formData?.dokumen ?? null;
  }, [selectedFile, localPreviewUrl, formData?.dokumen]);

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
    // FIX 1: Set container terluar ke h-screen dan overflow-hidden (untuk desktop)
    <div className="flex h-screen bg-gray-50"> 
      
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - FIX 2: Container fixed di desktop dan mobile. */}
      {/* Di desktop, ini akan menjadi kolom kiri, dan konten utama akan memiliki margin. */}
      <div className={`fixed top-0 left-0 z-40 transition-transform duration-300 transform w-64 h-screen bg-white shadow-2xl lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* FIX 3: Sidebar component fills container height */}
        <Sidebar activeView='database' style={{ height: '100%' }} />
      </div>
      
      {/* Main Content - FIX 4: Gunakan ml-64 di desktop dan overflow-y-auto untuk scroll konten */}
      {/* Di mobile, ml-0 karena sidebar fixed menimpa konten. */}
      <main className={`flex-grow p-4 md:p-8 w-full transition-all duration-300 lg:ml-64 overflow-y-auto`}> 
      
        {/* Hamburger Menu for Mobile */}
        <div className="lg:hidden flex justify-start mb-4">
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-full bg-indigo-600 text-white shadow-md"
            >
                <Menu size={24} />
            </button>
        </div>
        
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Data Kehadiran Jemaat
          </h1>
          <div className="flex space-x-3">
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
            handleDeleteEvent={handleDeleteEvent}
            handleOpenEditEvent={handleOpenEditEvent}
            handleOpenAddEvent={handleOpenAddEvent} 
          />
        </div>

        {tablesToRender.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 flex-wrap mb-6"> 
              <span className="font-semibold text-gray-700 text-sm">Filter:</span>
              
              <select 
                value={filterStatusKehadiran} 
                onChange={e => setFilterStatusKehadiran(e.target.value)}
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
              
              <div className="flex-grow flex justify-end gap-2 mt-2 sm:mt-0">
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm sm:text-base" 
                  >
                    <Settings size={18} />
                    <span className="hidden sm:inline">Edit Data</span>
                    <span className="sm:hidden">Edit</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveEdit}
                      className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm sm:text-base" 
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="px-3 sm:px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition text-sm sm:text-base"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-8" id="table-container"> 
              
              {tablesToRender.map(({ date, event }, idx) => {
                
                const dataToRender = getFilteredJemaat(jemaat);
                    
                const filteredData = dataToRender;
                
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
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[100px]">Dokumen</th> 
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[80px]">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pagedData.map((j, i) => {
                            const draftItem = j;
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
                                  {j.id}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <Image
                                    src={j.foto}
                                    alt={j.nama}
                                    width={40}
                                    height={40}
                                    className="rounded-full h-10 w-10 object-cover shadow-sm"
                                    unoptimized
                                  />
                                </td>
                                
                                <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={draftItem.nama}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 w-full focus:border-indigo-500 focus:outline-none text-sm"
                                      readOnly // Set readOnly for non-edit mode display
                                    />
                                  ) : (
                                    j.nama
                                  )}
                                </td>
                                
                                <td className="px-3 py-3 whitespace-nowrap text-sm">
                                  {editMode ? (
                                    <select
                                      value={draftItem.statusKehadiran}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none text-sm"
                                      disabled // Set disabled for non-edit mode display
                                    >
                                      <option value="Aktif">Aktif</option>
                                      <option value="Jarang Hadir">Jarang Hadir</option>
                                      <option value="Tidak Aktif">Tidak Aktif</option>
                                    </select>
                                  ) : (
                                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm ${
                                      j.statusKehadiran === "Aktif" 
                                        ? 'bg-green-100 text-green-800 border border-green-200' 
                                        : j.statusKehadiran === "Jarang Hadir"
                                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                        : 'bg-red-100 text-red-800 border border-red-200'
                                    }`}>
                                      {j.statusKehadiran}
                                    </span>
                                  )}
                                </td>
                                
                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {editMode ? (
                                    <select
                                      value={draftItem.jabatan}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none text-sm"
                                      disabled // Set disabled for non-edit mode display
                                    >
                                      <option value="Jemaat">Jemaat</option>
                                      {uniqueJabatan.map((jab) => (
                                        <option key={jab} value={jab}>{jab}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    j.jabatan
                                  )}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {draftItem.kehadiranSesi}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                                  {j.dokumen ? (
                                    <button
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        openPreviewModal(j); 
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-xs font-medium"
                                      title={j.dokumen.includes('.pdf') || j.dokumen.startsWith('data:application/pdf') ? "Preview PDF" : "Preview Gambar"}
                                    >
                                      {j.dokumen.includes('.pdf') || j.dokumen.startsWith('data:application/pdf') ? <FileText size={14} /> : <LucideImage size={14} />}
                                      Preview
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-center">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      handleRowClick(j); 
                                    }}
                                    className="px-3 py-1.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-xs font-medium" 
                                  >
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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

        {/* ... (Modals dan Drawers) */}
      </main>
      
      {/* CSS Inline untuk animasi */}
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
      `}</style>
    </div>
  );
}