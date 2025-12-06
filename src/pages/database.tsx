// src/pages/database.tsx
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Download, X, Settings, ChevronLeft, ChevronRight, BarChart3, Calendar, Loader2, Pencil, Menu, Eye } from "lucide-react"; 
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';
import { jsPDF } from 'jspdf';
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";
import dynamic from 'next/dynamic'; 
// FIX 1: Import tipe data yang lebih lengkap dari API route
import { type JemaatClient, type StatusKehadiran, type JemaatWithAttendanceInfo, type JemaatAPIResponse as FullJemaatAPIResponse } from "~/app/api/jemaat/route"; 
import type { EventModalData } from "@/types/event-modal";
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


// --- Tipe Data Lainnya ---

// List Jemaat Unik (untuk status overall, edit form, dan draft)
interface UniqueJemaat extends JemaatClient {
  id: string; // id_jemaat
}

// Baris Data Kehadiran (untuk tabel dan detail drawer - Attendance Instance)
interface JemaatRow extends JemaatWithAttendanceInfo {
  id: string; // id_jemaat-tanggal (ID unik per record kehadiran)
  // Semua properti dari JemaatClient juga ada di sini
}

// Tipe Response dari API (Gunakan alias)
interface JemaatAPIResponse extends FullJemaatAPIResponse {
  error?: string;
  weeklyEvents?: WeeklyEvent[];
  jemaatData: UniqueJemaat[]; 
}



export interface PreviewModalData {
    url: string; 
    name: string;
    type: 'image' | 'pdf' | 'other';
}

type ViewMode = 'event_per_table' | 'monthly_summary';
type SelectedEventsByDate = Record<string, string[]>;
type EventsCache = Record<string, string[]>;

interface CustomConfirmation {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    showCancelButton?: boolean;
}

// Komponen Modal yang dimuat secara dinamis
const DynamicDocumentPreviewModal = dynamic(() => import('../components/DocumentPreviewModal'), {
    loading: () => null, 
    ssr: false, 
});

const DynamicEventManagementModal = dynamic(() => import('../components/EventManagementModal'), {
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

/**
 * PERBAIKAN: Fungsi ini sekarang mengambil SESI UNIK (jenis_kebaktian) dari data kehadiran 
 * yang sudah diambil dari backend, BUKAN lagi hardcode.
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

        // ✅ Loop lewat semua tanggal Ibadah yang dikembalikan dari API
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
  currentEvents: EventsCache
): { date: Date, key: string, events: string[] }[] => {
  const daysInMonth = getDaysInMonth(month, currentYear);
  const dates: { date: Date, key: string, events: string[] }[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, month, day);
    const dayKey = getDayKey(date);
    
    // HANYA proses tanggal yang sudah lewat atau hari ini
    if (new Date(date).setHours(0, 0, 0, 0) <= todayStart) { 
      
      // Event list untuk tanggal ini: ambil dari cache atau array kosong
      const currentEventList = currentEvents[dayKey] ?? []; 
      
      // Selalu tambahkan tanggal yang sudah lewat/sekarang, meskipun event list kosong.
      dates.push({ date, key: dayKey, events: currentEventList });
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
 * Perbaikan utama: Logika perhitungan end date dan iterasi mingguan/bulanan
 */
const generateDatesForPeriod = (startDayKey: string, dayOfWeek: number | 'Per Tanggal', period: string): string[] => {
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
        const match = /^(\d+)([my])$/.exec(period);
        if (!match) {
            console.error("Invalid period format:", period);
            return [];
        }
        
        const duration = parseInt(match[1]!, 10);
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
    
    // const todayTime = new Date().setHours(0, 0, 0, 0); // Logic ini dihapus karena user ingin semua tanggal ke depan di-generate

    if (dayOfWeek === 'Per Tanggal') { // Monthly Repetition Logic
        currentDate.setDate(1); // Set ke tanggal 1
        currentDate.setMonth(currentDate.getMonth() + 1); // Pindah ke bulan berikutnya

        const targetDay = baseDate.getDate(); // Tanggal perulangan (misal: tgl 15)
        
        while (currentDate.getTime() <= endDate.getTime()) {
            currentDate.setDate(targetDay); // Set ke tanggal target
            
            // Cek jika tanggal yang dihasilkan valid
            if (currentDate.getMonth() === currentDate.getMonth()) {
                const dayKey = getDayKey(currentDate);
                dates.push(dayKey);
            }
            
            // Pindah ke bulan berikutnya
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

    } else { // Weekly Repetition Logic
        
        // 3. Cari kemunculan pertama dari dayOfWeek yang diminta
        currentDate = getNextDayOfWeek(currentDate, dayOfWeek);
        
        // 4. Loop untuk mengumpulkan semua tanggal yang valid
        while (currentDate.getTime() <= endDate.getTime()) {
            // Hanya tambahkan tanggal (tanpa mempedulikan masa depan/sekarang/lalu)
            const dayKey = getDayKey(currentDate);
            dates.push(dayKey);
            
            // Pindah ke minggu berikutnya (7 hari)
            currentDate.setDate(currentDate.getDate() + 7);
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
            if (typeof window !== 'undefined') {
                 setIsMobileView(window.innerWidth < 768);
            }
        };
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
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
                        const isFutureDay = dateTimestamp > todayStart; // Keep for visual cue
                        
                        const hasAttendanceData = attendanceSet.has(dayKey);
                        
                        let dayClass = "relative p-1.5 rounded-full transition-all duration-150 text-xs md:text-sm cursor-pointer";
                        
                        if (isSelected) {
                          // Tetap tampilkan warna biru jika terpilih
                          dayClass += " bg-indigo-600 text-white font-bold shadow-md"; 
                        } else { 
                          // All others
                          dayClass += " text-gray-700 hover:bg-indigo-200";
                        }
                        
                        if (isFutureDay && !isSelected) {
                            // Soften future dates but keep them clickable
                            dayClass += " text-indigo-400 font-normal hover:bg-indigo-100";
                        }

                        return (
                          <div 
                            key={i} 
                            className={dayClass} 
                            // NEW: Allow all clicks
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
    weeklyEvents: WeeklyEvent[]; // DITAMBAHKAN
}

const SelectedEventsSection = ({
    selectedDates, selectedEventsByDate, events, viewMode,
    handleSelectEvent, handleDeleteEvent, handleOpenEditEvent,
    handleOpenAddEvent, weeklyEvents 
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
                                const isPeriodical = periodicalEventNames.has(ev); // DITAMBAHKAN

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
    if (!data?.isOpen) return null;

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

  // FIX 2: Ganti tipe state jemaat
  const [uniqueJemaatList, setUniqueJemaatList] = useState<UniqueJemaat[]>([]); // Data unik Jemaat
  const [attendanceRecords, setAttendanceRecords] = useState<JemaatRow[]>([]); // Data granular kehadiran
  const [draftUniqueJemaatList, setDraftUniqueJemaatList] = useState<UniqueJemaat[]>([]); // Draft untuk edit mode
  
  const [isLoading, setIsLoading] = useState(true); 
  
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>((currentMonth - 1 + 12) % 12);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(Math.floor(currentYear / 10) * 10);
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<SelectedEventsByDate>({});
  const [events, setEvents] = useState<EventsCache>(() => memoryStorage.events || {});
  const [actualAttendanceDates, setActualAttendanceDates] = useState<string[]>([]); // NEW STATE
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]); // DITAMBAHKAN
  const [viewMode, setViewMode] = useState<ViewMode>('event_per_table');
  
  const [confirmationModal, setConfirmationModal] = useState<CustomConfirmation | null>(null);

  const showConfirmation = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void, 
    showCancelButton = false, 
    onCancel: () => void = () => setConfirmationModal(null)
  ) => {
    setConfirmationModal({ isOpen: true, title, message, onConfirm, onCancel, showCancelButton });
  }, []);


  const showAlert = useCallback((title: string, message: string) => {
      // PERBAIKAN: Menampilkan alert menggunakan ConfirmationModal (bukan window.alert)
      setConfirmationModal({ isOpen: true, title, message, onConfirm: () => setConfirmationModal(null), onCancel: () => setConfirmationModal(null), showCancelButton: false });
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
  // FIX: Tambahkan kembali deklarasi state yang hilang
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false); // <-- FIX DITAMBAHKAN
  // FIX: Ganti tipe formData ke JemaatRow (Attendance Instance)
  const [formData, setFormData] = useState<JemaatRow | null>(null);
  const itemsPerPage = 10;
  
  const [filterStatusKehadiran, setFilterStatusKehadiran] = useState<StatusKehadiran | "">(""); 
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterKehadiranSesi, setFilterKehadiranSesi] = useState(""); 
  
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);
  const [, setSelectedFile] = useState<File | null>(null);
  const [isUploading] = useState(false);
  const [previewModalData, setPreviewModalData] = useState<PreviewModalData | null>(null);
  
  const selectedDatesOnly = useMemo(() => selectedDates.map(getDayKey), [selectedDates]); 
  
  /*
  const localPreviewUrl = useMemo(() => {
    if (selectedFile && isImageUrlOrBase64(selectedFile.name)) {
        return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);
  */

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
    // 💡 FUNGSI INI MENGAMBIL DATA UTAMA DARI TABEL KEHADIRAN & JEMAAT
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [jemaatRes, weeklyEventsRes] = await Promise.all([
          fetch("/api/jemaat"), // Data Jemaat dan Kehadiran
          fetch("/api/weekly-events"), // Data Event Berkala (DITAMBAHKAN)
        ]);

        // --- 1. PROSES DATA JEMAAT/KEHADIRAN ---
        const data: unknown = await jemaatRes.json();
        const apiResponse = data as JemaatAPIResponse;
        
        if (apiResponse.error) {
          console.error("API Jemaat Error Body:", apiResponse.error);
          showAlert(
            "Gagal Mengambil Data Jemaat", 
            `Terjadi kesalahan pada server/database: ${apiResponse.error}`
          );
          throw new Error(apiResponse.error);
        }
        if (!jemaatRes.ok) {
          throw new Error(`Gagal fetch data jemaat. Status: ${jemaatRes.status}`);
        }

        const fetchedUniqueJemaat = apiResponse.jemaatData || [];
        setUniqueJemaatList(fetchedUniqueJemaat);
        setDraftUniqueJemaatList(fetchedUniqueJemaat.map(j => ({ ...j })));
        setAttendanceRecords((apiResponse.fullAttendanceRecords || []) as JemaatRow[]);
        const fetchedAttendanceDates = apiResponse.attendanceDates || [];
        setActualAttendanceDates(fetchedAttendanceDates); 
        
        // Ambil semua sesi unik dari data kehadiran (ini adalah jenis_kebaktian yang sudah di-join)
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

          showAlert(
            "Peringatan Data Event",
            `Gagal memuat event berkala: ${errorData.error ?? "Unknown error"}`
          );
        }

        // --- 3. INTEGRASI DAN CACHE EVENT ---
        const initialEvents: EventsCache = {};

        fetchedAttendanceDates.forEach((dateKey: string) => {
            const date = new Date(dateKey);
            // Gunakan sesi unik sebagai base event list
            initialEvents[dateKey] = populateEventsForDate(dateKey, date, allUniqueSessions); 
        });
        
        // **Menggunakan Logika Integrasi yang Benar**
        const mergedEvents = integrateWeeklyEvents(fetchedWeeklyEvents, initialEvents, allUniqueSessions);
        
        setEvents(mergedEvents);
        memoryStorage.events = mergedEvents;
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data (unknown error).";
        console.error("Error fetch data:", errorMessage);
        setUniqueJemaatList([]);
        setDraftUniqueJemaatList([]);
        setAttendanceRecords([]);
        setActualAttendanceDates([]); 
        setWeeklyEvents([]); 
        showAlert("Fatal Error", errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [showAlert]); 

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
        const datesInMonth = getDatesWithEventsInMonth(month, year, memoryStorage.events); 
        datesInMonth.forEach(d => {
            const date = d.date;
            const dateKey: string = d.key;
            
            let currentEvents = memoryStorage.events[d.key];
            
            // Gunakan sesi unik sebagai base event list jika belum di-cache atau kosong
            // PERUBAHAN KRITIS 1: Hanya isi event jika ada data kehadiran aktual
            if (!currentEvents || currentEvents.length === 0) {
                if (actualAttendanceDates.includes(dateKey)) { 
                    currentEvents = populateEventsForDate(dateKey, date, allUniqueSessions);
                } else {
                    currentEvents = []; // Biarkan kosong jika tidak ada data kehadiran aktual
                }
            }
            
            const dayOfWeek = date.getDay();

            // Integrate Weekly Events for the currently viewed month
            weeklyEvents.forEach(event => {
                const startDate = new Date(event.start_date).setHours(0, 0, 0, 0);
                const endDate = event.end_date ? new Date(event.end_date).setHours(0, 0, 0, 0) : Infinity;
                const currentDateTimestamp = date.setHours(0, 0, 0, 0);

                if (currentDateTimestamp >= startDate && currentDateTimestamp <= endDate) {
                    if (event.repetition_type === 'Monthly' || dayOfWeek === event.day_of_week || event.repetition_type === 'Once') {
                        const eventName = event.title;
                        const lowerEventName = eventName.toLowerCase();
                        const safeCurrentEvents = currentEvents ?? [];

                          if (!safeCurrentEvents.some(e => e.toLowerCase() === lowerEventName)) {
                            const listWithoutOverall = safeCurrentEvents.filter(
                              e => e !== "KESELURUHAN DATA HARI INI"
                            );

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
  }, [startMonth, year, attendanceRecords, weeklyEvents, actualAttendanceDates]); // actualAttendanceDates DITAMBAHKAN

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

    // 💡 Menggunakan getDatesWithEventsInMonth TANPA filter attendance
    const datesWithEventsInMonth = getDatesWithEventsInMonth(monthIndex, currentYear, memoryStorage.events);
    
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
  }, [viewMode, startMonth, year, setStartMonth, setYear, attendanceRecords]); 

   useEffect(() => {
    // FIX: Gunakan attendanceRecords
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

  // 💡 LOGIC UTAMA: Menghandle klik di kalender (DIBUAT AGAR SEMUA TANGGAL DAPAT DIKLIK)
  const handleSelectDate = useCallback((day: number, month: number) => {
    setViewMode('event_per_table'); 
    
    const clickedDate = new Date(year, month, day);
    const key = getDayKey(clickedDate);
    // const dateTimestamp = new Date(clickedDate).setHours(0, 0, 0, 0); // Logic dihapus
    // const isFuture = dateTimestamp > todayStart; // Logic dihapus
    
    // Logic pemblokiran tanggal masa depan telah dihapus

    const isCurrentlySelected = selectedDates.some(d => getDayKey(d) === key);
    
    // Handle Event Caching/Generation for ANY selected date (past/present/future)
    let currentEvents = events[key];
    const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));
    
    // 💡 FIX: Populasikan event jika belum ada di cache, HANYA JIKA ada data kehadiran aktual
    if (!currentEvents || currentEvents.length === 0) {
        if (actualAttendanceDates.includes(key)) { // <-- PERUBAHAN KRITIS 2: Cek attendance sebelum mengisi
            currentEvents = populateEventsForDate(key, clickedDate, allUniqueSessions);
        } else {
            currentEvents = []; // <-- Jika tidak ada data kehadiran, biarkan kosong
        }
        
        // Update cache
        setEvents(prev => ({ ...prev, [key]: currentEvents ?? [] }));
        memoryStorage.events[key] = currentEvents;
    }

    let newDates: Date[];
    const newEventsByDate = { ...selectedEventsByDate };
    const overallEvent = currentEvents.find(e => e === "KESELURUHAN DATA HARI INI"); // Gunakan currentEvents yang sudah diperbarui

    if (isCurrentlySelected) {
      // DESELECT
      newDates = selectedDates.filter(d => getDayKey(d) !== key);
      delete newEventsByDate[key];
      // 💡 Hapus dari cache event HANYA JIKA event list-nya kosong (berarti user tidak menambah event custom)
      if (events[key]?.length === 0 || (events[key]?.length === 1 && events[key]?.[0] === "KESELURUHAN DATA HARI INI" && !actualAttendanceDates.includes(key))) {
          setEvents(prev => {
             const updated = { ...prev };
             delete updated[key];
             memoryStorage.events = updated;
             return updated;
          });
      }
    } else {
      // SELECT
      newDates = [...selectedDates, clickedDate].sort((a, b) => a.getTime() - b.getTime());
      
      // 💡 Otomatis pilih 'KESELURUHAN DATA HARI INI' (HANYA jika ada di currentEvents)
      newEventsByDate[key] = overallEvent ? [overallEvent] : []; 
    }
    
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
  }, [events, selectedDates, selectedEventsByDate, year, attendanceRecords, actualAttendanceDates]);

  // **PERBAIKAN 2: Logika Pemilihan Event Berkala**
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
          
          // Iterasi hari demi hari dari start_date hingga end_date (atau hari ini, mana yang lebih dulu)
          // HILANGKAN BATAS TODAYSTART AGAR BISA MEMILIH EVENT BERKALA DI MASA DEPAN
          while (currentDate.getTime() <= endDate.getTime()) { 
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
  
  // **Logika Membuka Modal (Memastikan flow-select)**
  const handleOpenAddEvent = useCallback((dateKey: string) => {
    // 💡 Pemicu tampilan di gambar (flow-select)
    // const dateTimestamp = new Date(dateKey).setHours(0, 0, 0, 0); // Logic dihapus
    // if (dateTimestamp > todayStart) { // Blocking logic dihapus
    //     showAlert("Tambah Event Gagal", "Anda tidak bisa menambahkan event pada tanggal di masa depan.");
    //     return; 
    // }

      setEventModalData({
          type: 'flow-select', // Memastikan tampilan flow-select muncul
          dateKey,
          newName: '',
          oldName: null,
          periodicalDayOfWeek: new Date(dateKey).getDay(), 
          periodicalPeriod: '2m',
      });
      
      setShowEventModal(true);
  }, []);

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
        ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI" && e.toLowerCase() !== lowerNewName), 
        newName
    ].filter((v, i, a) => a.indexOf(v) === i);
    
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

  const handlePeriodicalAddEvent = useCallback(async () => {
    const { periodicalDayOfWeek, periodicalPeriod, newName, dateKey } = eventModalData;
    const eventName = newName?.trim();
    const dayOfWeek = periodicalDayOfWeek !== null ? periodicalDayOfWeek : new Date(dateKey ?? '').getDay();

    if (!eventName || dayOfWeek === undefined || !dateKey || !periodicalPeriod) {
        showAlert("Data Tidak Lengkap", "Pastikan semua field telah diisi dengan benar.");
        return;
    }
    
    // 1. Hitung Tanggal Akhir
    let end_date: string | null = null;
    if (periodicalPeriod !== '10y') {
        const baseDate = new Date(dateKey);
        const endDate = new Date(baseDate.getTime());
        
        const match = /^(\d+)([my])$/.exec(periodicalPeriod);
        if (match) {
            const duration = parseInt(match[1]!, 10);
            const unit = match[2]!;
            
            if (unit === 'm') {
                endDate.setMonth(endDate.getMonth() + duration);
            } else if (unit === 'y') {
                endDate.setFullYear(endDate.getFullYear() + duration);
            }
            end_date = getDayKey(endDate);
        }
    }
    
    // 2. Siapkan Payload API
    const title = eventName;
    const jenis_kebaktian = eventName; // Gunakan nama event sebagai jenis_kebaktian
    const sesi_ibadah = 99; // Placeholder

    const isMonthlyRepetition = periodicalPeriod && /^(\d+)m$/.test(periodicalPeriod);
    const repetitionType = isMonthlyRepetition ? 'Monthly' : 'Weekly';
    
    const payload = {
      title: title,
      description: `Event berkala dimulai ${new Date(dateKey).toLocaleDateString()} (${periodicalPeriod})`,
      jenis_kebaktian: jenis_kebaktian,
      sesi_ibadah: sesi_ibadah,
      start_date: dateKey,
      day_of_week: isMonthlyRepetition ? null : dayOfWeek,
      repetition_type: repetitionType,
      end_date: end_date,
    };
    
    // --- API CALL FOR PERSISTENCE ---
    try {
        const res = await fetch("/api/weekly-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorData = (await res.json().catch(() => ({ message: "Unknown API error or malformed response." }))) as { error?: string; message?: string };
            throw new Error(`Gagal menyimpan event berkala. Status: ${res.status}. Pesan: ${errorData.error ?? errorData.message ?? JSON.stringify(errorData)}`);
        }
        
        // 3. Update State (Refresh data event dari API)
        const weeklyEventsRes = await fetch("/api/weekly-events");
        let updatedWeeklyEvents = weeklyEvents;
        if (weeklyEventsRes.ok) {
             updatedWeeklyEvents = await weeklyEventsRes.json() as WeeklyEvent[];
             setWeeklyEvents(updatedWeeklyEvents);
        }

        const allUniqueSessions = new Set(attendanceRecords.map(j => j.kehadiranSesi));
        const newEventsCache = integrateWeeklyEvents(updatedWeeklyEvents, memoryStorage.events, allUniqueSessions);
        setEvents(newEventsCache);
        memoryStorage.events = newEventsCache;
        
        // 4. Update UX Selection (Pilih otomatis semua tanggal)
        const newDates: Date[] = [];
        const newEventsByDate: SelectedEventsByDate = {};
        
        const newPeriodicalEvent = updatedWeeklyEvents.find(e => e.title === eventName);
        if (newPeriodicalEvent) {
            const currentDate = new Date(newPeriodicalEvent.start_date);
            const loopEndDate = newPeriodicalEvent.end_date 
                ? new Date(newPeriodicalEvent.end_date) 
                : new Date(today.getFullYear() + 10, 0, 1);
            
            while (currentDate <= loopEndDate) {
                const currentKey = getDayKey(currentDate);
                const availableEvents = newEventsCache[currentKey] ?? [];

                // Match event title regardless of day_of_week
                if (availableEvents.includes(eventName)) {
                    newDates.push(new Date(currentKey));
                    newEventsByDate[currentKey] = [eventName];
                }

                // Move to next day to check
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        
        setSelectedDates(newDates.sort((a, b) => a.getTime() - b.getTime()));
        setSelectedEventsByDate(newEventsByDate);
        saveSelection(newDates, newEventsByDate);

        showAlert(
            "Sukses Penambahan Berkala", 
            `Event "${eventName}" berhasil disimpan dan ${newDates.length} tanggal otomatis terpilih.`
        );

        setShowEventModal(false);
        setEventModalData({});
        
    } catch (error) {
        console.error("Error saving periodical event:", error);
        showAlert("Gagal Menyimpan Event", (error as Error).message);
        setShowEventModal(false);
    }
  }, [eventModalData, showAlert, attendanceRecords, weeklyEvents]);

  const handleEventAction = useCallback(() => {
    switch(eventModalData.type) {
        case 'add-single':
            handleSingleAddEvent();
            break;
        case 'add-periodical':
            // Panggil async handler di sini
            void handlePeriodicalAddEvent();
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
            showAlert("Sukses Edit Satuan", `Event berhasil diubah dari "${oldName}" menjadi "${newNameTrim}" pada tanggal ${new Date(key).toLocaleDateString("id-ID")}.`);
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

                    // Filter: hanya tanggal setelah/sama dengan tanggal awal
                    if (currentDate >= startDate) { // Removed blocking future dates logic
                        const eventsList = updatedEvents[key] ?? [];
                        
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

                    // Filter: hanya tanggal setelah/sama dengan tanggal awal
                    if (currentDate >= startDate) { // Removed blocking future dates logic
                         const selectedList = updatedSelected[key] ?? [];
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
  }, [
      eventModalData,
      handleSingleAddEvent,
      handlePeriodicalAddEvent,
      selectedDates,
      showAlert
    ]);

  const handleDeleteEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return; 
      
      const isPeriodicalEvent = weeklyEvents.find(e => e.title === eventName);

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
          showAlert("Sukses Hapus Satuan", `Event "${eventName}" berhasil dihapus HANYA di tanggal ini.`);
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
      
      if (isPeriodicalEvent) {
          showConfirmation(
              "Konfirmasi Penghapusan Event Berkala",
              `Event "${eventName}" adalah event berkala. Apakah Anda ingin menghapus HANYA untuk tanggal ini? (Pilih 'Batal' untuk menghapus SEMUA event di database dan tanggal setelahnya).`,
              onConfirm,
              true,
              onCancel
          );
      } else {
          showConfirmation(
              "Konfirmasi Penghapusan",
              `Apakah Anda yakin ingin menghapus Event "${eventName}" HANYA untuk tanggal ini?`,
              onConfirm,
              true,
              () => setConfirmationModal(null) 
          );
      }
      
  }, [selectedDates, showConfirmation, showAlert, weeklyEvents]);

  const handleOpenEditEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return;
      
      const isPeriodicalEvent = weeklyEvents.find(e => e.title === eventName);
      
      if (!isPeriodicalEvent) {
          setEventModalData({ 
            type: 'edit-single', 
            dateKey, 
            oldName: eventName, 
            newName: eventName,
            periodicalDayOfWeek: null,
            periodicalPeriod: '2m',
          });
          setShowEventModal(true);
          return;
      }

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
          "Konfirmasi Pengeditan Event Berkala",
          `Event "${eventName}" adalah event berkala. Apakah Anda ingin mengedit nama event ini untuk SEMUA tanggal yang akan datang? (Pilih 'Batal' untuk mengedit HANYA tanggal ini).`,
          onConfirm,
          true,
          onCancel
      );
      
  }, [showConfirmation, weeklyEvents]);

  const handleSaveEdit = useCallback(() => {
    setEditMode(false);
    // FIX 6: Simpan dari draft ke list unik utama
    setUniqueJemaatList(draftUniqueJemaatList.map(d => ({ ...d })));
    showAlert("Sukses", "Perubahan data jemaat berhasil disimpan (dalam memori lokal).");
  }, [draftUniqueJemaatList, showAlert]);
  
  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    // FIX 6: Muat ulang draft dari list unik utama
    setDraftUniqueJemaatList(uniqueJemaatList.map(j => ({ ...j })));
    showAlert("Batal", "Perubahan dibatalkan.");
  }, [uniqueJemaatList, showAlert]);
  
  const handleSelectYearFromGrid = useCallback((selectedYear: number) => {
    setYear(selectedYear);
    setShowYearDialog(false);
  }, []);
  
  const calculatedAge = useMemo(() => {
    return calculateAge(formData?.tanggalLahir);
  }, [formData?.tanggalLahir]);
  
  // FIX 4: LOGIKA FILTER UTAMA: Filter data JemaatRow (Attendance Records)
  const getFilteredJemaatPerEvent = useCallback((attendanceRecords: JemaatRow[], dateKey: string, event: string): JemaatRow[] => {
      
    // STEP 1: Filter KETAT - hanya record kehadiran yang tanggalKehadirannya PERSIS SAMA dengan dateKey
    const filteredByDate = attendanceRecords.filter(j => j.tanggalKehadiran === dateKey);

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
        // Untuk keseluruhan data hari ini, tampilkan semua record kehadiran di tanggal ini
        if (filterKehadiranSesi !== "") {
            return filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        return filteredData; 
    }
    
    // Filter berdasarkan sesi spesifik
    return filteredData.filter(j => j.kehadiranSesi === event);
  }, [filterStatusKehadiran, filterJabatan, filterKehadiranSesi]);


  const getFilteredJemaatMonthlySummary = useCallback((uniqueJemaatList: UniqueJemaat[], attendanceRecords: JemaatRow[]): JemaatRow[] => {
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
        return getFilteredJemaatMonthlySummary(uniqueJemaatList, attendanceRecords);
    }
    
    if (selectedTables.length === 1 && selectedTables[0]) {
        // Gabungkan data filter event dengan data jemaat unik terbaru
        const filteredByEvent = getFilteredJemaatPerEvent(attendanceRecords, selectedTables[0].date, selectedTables[0].event);
        
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
    return filtered.slice(indexOfFirst, indexOfFirst + itemsPerPage); // Fix slice end index
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
    if (!editMode) {
      setFormData({ ...row });
      setOpenDetailDrawer(true);
      setSelectedFile(null); 
    }
  }, [editMode]);
  
  // FIX 6: Perbarui handleSaveForm (harus menyimpan ke UniqueJemaatList)
  const handleSaveForm = useCallback(async () => {
    if (!formData) return;

    // Ambil ID Jemaat unik (id_jemaat)
    const jemaatId = formData.id.slice(0, 36);
    
    // 1. Prepare payload for API
    const payload = {
        id_jemaat: jemaatId,
        name: formData.nama,
        jabatan: formData.jabatan,
        email: formData.email,
        handphone: formData.telepon, // Map to handphone field in Supabase
        tanggal_lahir: formData.tanggalLahir, // YYYY-MM-DD
    };

    try {
        const res = await fetch("/api/jemaat", {
            method: "PATCH", // Menggunakan endpoint PATCH yang baru dibuat
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
          // Menggunakan errorBody.error yang sudah diperkaya di backend
          throw new Error(
            errorBody.error ?? `Gagal menyimpan data jemaat. Status: ${res.status}`
          );
        }
        
        // API call was successful, now apply local changes

        const updatedFormData = { ...formData };
        if (updatedFormData.tanggalLahir) {
            // Gunakan fungsi calculateAge yang sudah ada di file ini
            updatedFormData.umur = calculateAge(updatedFormData.tanggalLahir); 
        } else {
            updatedFormData.umur = undefined;
        }

        const updatedUniqueJemaat: UniqueJemaat = {
            // ... copy semua properti dari JemaatClient
            ...updatedFormData,
            id: jemaatId, // Pastikan ID adalah ID Jemaat
            // Hapus properti JemaatRow yang tidak ada di UniqueJemaat
            tanggalKehadiran: undefined,
            waktuPresensiFull: undefined,
        } as UniqueJemaat;
        
        // 2. Update Unique Jemaat List (Source of truth)
        setUniqueJemaatList(prev => prev.map(j => 
            j.id === jemaatId ? updatedUniqueJemaat : j
        ));
        
        // 3. Update Draft Unique Jemaat List
        setDraftUniqueJemaatList(prev => prev.map(j => 
            j.id === jemaatId ? updatedUniqueJemaat : j
        ));
        
        // 4. Update Attendance Records
        setAttendanceRecords(prev => prev.map(j => 
             j.id.split('-')[0] === jemaatId ? { 
                ...j, 
                // Copy semua field dari UniqueJemaat
                ...updatedUniqueJemaat,
                // Pertahankan properti JemaatRow
                tanggalKehadiran: j.tanggalKehadiran,
                waktuPresensiFull: j.waktuPresensiFull,
             } : j
        ));

        showAlert("Sukses", `Data jemaat ${formData.nama} berhasil disimpan ke Supabase.`);
        setOpenDetailDrawer(false);
        setSelectedFile(null); 

    } catch (error) {
        console.error("Error saving form:", error);
        showAlert("Gagal Menyimpan", (error as Error).message);
    }
  }, [formData, showAlert]);
  
  /*
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files ? event.target.files[0] : null;
      setSelectedFile(file ?? null);
      if (file) {
          setFormData(f => f ? { ...f, dokumen: undefined } : null);
      }
  }, []);
  */
  
  /*
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
  */
  
  /*
  const openPreviewModal = useCallback((jemaatItem: JemaatRow) => {
    if (!jemaatItem.dokumen) return;

    let type: PreviewModalData['type'];
    if (isImageUrlOrBase64(jemaatItem.dokumen as string)) {
        type = 'image';
    } else if (typeof jemaatItem.dokumen === 'string' && (jemaatItem.dokumen.includes('.pdf') || jemaatItem.dokumen.startsWith('data:application/pdf'))) {
        type = 'pdf';
    } else {
        type = 'other';
    }
    
    setPreviewModalData({
        url: jemaatItem.dokumen as string,
        name: `${jemaatItem.nama}'s Document`,
        type: type
    });
  }, []);
  */

  const closePreviewModal = useCallback(() => {
    setPreviewModalData(null);
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
          
          const keys: (keyof JemaatRow)[] = ['id', 'nama', 'statusKehadiran', 'jabatan', 'kehadiranSesi', 'email', 'telepon'];
          
          tablesToRender.forEach(({ date, event }, tableIndex) => {
            // FIX: Gunakan getFilteredJemaat dengan kedua list data
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
              // FIX: Gunakan getFilteredJemaat dengan kedua list data
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
        showAlert("Download Gagal", `Gagal membuat laporan ${format.toUpperCase()}. Periksa konsol untuk detail error.`);
      } finally {
        const finalLoadingDiv = document.getElementById('download-loading');
        if (finalLoadingDiv) {
            document.body.removeChild(finalLoadingDiv);
        }
      }
  }, [tablesToRender, selectedDates, viewMode, startMonth, year, uniqueJemaatList, attendanceRecords, showAlert, getFilteredJemaat]);

  const showSesiFilter = useMemo(() => {
    if (viewMode === 'monthly_summary') return true;
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return true;
    }
    
    return false;
  }, [viewMode, selectedTables]);
  
  /*
  const getPreviewUrl = useMemo(() => {
    if (selectedFile) {
        if (localPreviewUrl) return localPreviewUrl;
        return null; 
    }
    return formData?.dokumen ?? null;
  }, [selectedFile, localPreviewUrl, formData?.dokumen]);\
  */

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
    // FIX 1: Set outer container to h-screen and overflow-hidden (for desktop)
    <div className="flex h-screen bg-gray-50"> 
      
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - PERBAIKAN: Gunakan lg:fixed di desktop, bukan lg:relative */}
      <div className={`fixed top-0 left-0 z-40 transition-transform duration-300 transform w-64 h-screen bg-white shadow-2xl lg:shadow-none lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* FIX 3: Sidebar component fills container height */}
        <Sidebar activeView='database' isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {/* Main Content - PERBAIKAN KRITIS: Tambahkan lg:ml-64 untuk mengimbangi sidebar w-64 */}
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
            weeklyEvents={weeklyEvents} // DITAMBAHKAN
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
                
                // FIX 5: Gunakan getFilteredJemaat dengan kedua list data
                const filteredData = getFilteredJemaat(uniqueJemaatList, attendanceRecords);
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
                                    {/* <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[100px]">Dokumen</th>  */}
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[80px]">Aksi</th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {pagedData.map((j, i) => {
                                    // FIX 6: Cari draft item dari draftUniqueJemaatList
                                    const jemaatId = j.id.split('-')[0] ?? j.id;
                                    const draftItem = draftUniqueJemaatList.find(d => d.id === jemaatId) ?? j;
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
                                            onChange={(e) => setDraftUniqueJemaatList(prev => prev.map(d => d.id === jemaatId ? { ...d, nama: e.target.value } : d))}
                                            className="border-2 border-indigo-300 rounded px-2 py-1 w-full focus:border-indigo-500 focus:outline-none text-sm"
                                            onClick={(e) => e.stopPropagation()} 
                                            />
                                        ) : (
                                            j.nama
                                        )}
                                        </td>
                                        
                                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                                        {editMode ? (
                                            <select
                                            value={draftItem.statusKehadiran}
                                            onChange={(e) => setDraftUniqueJemaatList(prev => prev.map(d => d.id === jemaatId ? { ...d, statusKehadiran: e.target.value as StatusKehadiran } : d))}
                                            className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none text-sm"
                                            onClick={(e) => e.stopPropagation()} 
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
                                            value={draftItem.jabatan ?? "Jemaat"}
                                            onChange={(e) => setDraftUniqueJemaatList(prev => prev.map(d => d.id === jemaatId ? { ...d, jabatan: e.target.value } : d))}
                                            className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none text-sm"
                                            onClick={(e) => e.stopPropagation()} 
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
                                        {/* <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                                        {j.dokumen ? (
                                            <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                openPreviewModal(j); 
                                            }}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-xs font-medium"
                                            title={typeof j.dokumen === 'string' && (j.dokumen.includes('.pdf') || j.dokumen.startsWith('data:application/pdf')) ? "Preview PDF" : "Preview Gambar"}
                                            >
                                            {typeof j.dokumen === 'string' && (j.dokumen.includes('.pdf') || j.dokumen.startsWith('data:application/pdf')) ? <FileText size={14} /> : <LucideImage size={14} />}
                                            Preview
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">N/A</span>
                                        )}
                                        </td> */}
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                        <button 
                                            onClick={(e) => { 
                                            e.stopPropagation(); 
                                            handleRowClick(j); 
                                            }}
                                            className="px-3 py-1.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-xs font-medium flex items-center gap-1 mx-auto" 
                                        >
                                            <Eye size={14} /> Detail
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
                                <p className="text-sm">Meskipun event ini telah dipilih, tidak ada data kehadiran jemaat yang tercatat untuk tanggal/sesi ini berdasarkan filter saat ini.</p>
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

        {showYearDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm"> 
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                Pilih Tahun
              </h3>

              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setGridStartYear(prev => prev - 10)}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                  aria-label="Previous Decade"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-lg font-semibold text-gray-700">
                  {gridStartYear} - {gridStartYear + 9}
                </span>
                <button
                  onClick={() => setGridStartYear(prev => prev + 10)}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full transition"
                  aria-label="Next Decade"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 10 }, (_, i) => gridStartYear + i).map((y) => (
                  <button
                    key={y}
                    onClick={() => handleSelectYearFromGrid(y)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg transition duration-150
                      ${y === year
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-600'
                      }
                      
                    `}
                    // Hapus disabled={y > currentYear} agar bisa memilih tahun masa depan
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setShowYearDialog(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Detail Drawer (Editable) */}
        {openDetailDrawer && formData && (
          <div 
            className="fixed inset-0 bg-black/50 flex justify-end z-50"
            // ✅ Menutup drawer saat overlay diklik
            onClick={() => { setOpenDetailDrawer(false); setSelectedFile(null); }}
          >
            <div 
              className="bg-white w-full max-w-md h-full overflow-y-auto animate-slide-in"
              // ✅ Mencegah penutupan drawer saat konten di dalamnya diklik
              onClick={(e) => e.stopPropagation()}
            > 
              <div className="p-6">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                  <h2 className="text-2xl font-bold text-indigo-700">Detail Jemaat</h2>
                  <button
                    onClick={() => { setOpenDetailDrawer(false); setSelectedFile(null); }}
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
                      
                    {/* Nama */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nama Lengkap
                      </label>
                      <input
                        type="text" 
                        value={formData.nama}
                        onChange={e => setFormData(f => f ? { ...f, nama: e.target.value } : null)}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    
                    {/* Tanggal Lahir */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tanggal Lahir
                      </label>
                      <input
                        type="date" 
                        // Pastikan format date input adalah YYYY-MM-DD
                        value={formData.tanggalLahir ?? ""}
                        onChange={e => {
                          const newDate = e.target.value;
                          const newAge = calculateAge(newDate); 
                          setFormData(f => f ? { ...f, tanggalLahir: newDate, umur: newAge } : null);
                        }}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Umur (Read-Only, calculated) */}
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
                    
                    {/* Keluarga (Read-only from API) */}
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

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email ?? ""}
                        onChange={e => setFormData(f => f ? { ...f, email: e.target.value } : null)}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* No. Telp */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        No. Telp
                      </label>
                      <input
                        type="tel"
                        value={formData.telepon ?? ""}
                        onChange={e => setFormData(f => f ? { ...f, telepon: e.target.value } : null)}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Status Kehadiran (Read-Only, Derived) */}
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

                    {/* Jabatan (Selectable) */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Jabatan
                      </label>
                      <select
                        value={formData.jabatan ?? "Jemaat"}
                        onChange={e => setFormData(f => f ? { ...f, jabatan: e.target.value } : null)}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-500 bg-white"
                      >
                          <option value="Jemaat">Jemaat</option>
                          {uniqueJabatan.map((jab) => (
                            <option key={jab} value={jab}>{jab}</option>
                          ))}
                      </select>
                    </div>
                    
                    {/* Dokumen Section
                    <div className="border-t pt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Dokumen (KTP/Kartu Keluarga, dll)
                      </label>
                      {formData.dokumen ? (
                        <div className="flex items-center gap-2 mb-3 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                            <span className="text-sm text-indigo-700 font-medium truncate">
                                {typeof formData.dokumen === 'string' && (formData.dokumen.includes('.pdf') ? 'Dokumen PDF' : 'Dokumen Gambar')} Tersimpan
                            </span>
                            <button
                                onClick={() => openPreviewModal(formData)}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                            >
                                <Eye size={14} /> Lihat
                            </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-3">Belum ada dokumen yang diunggah.</p>
                      )}
                      
                      <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            id="document-upload"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                          
                          {selectedFile && (
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm text-gray-600 truncate">{selectedFile.name}</span>
                                <button
                                    onClick={handleFileUpload}
                                    disabled={isUploading}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
                                >
                                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                                    {isUploading ? 'Mengunggah...' : 'Unggah Dokumen'}
                                </button>
                            </div>
                          )}
                      </div>
                    </div> */}

                  </div>
                </div>
                
                <div className="pt-6 flex justify-end space-x-3 border-t mt-8">
                  <button
                    onClick={() => { setOpenDetailDrawer(false); setSelectedFile(null); }}
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => void handleSaveForm()}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
                    disabled={isUploading}
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DOWNLOAD */}
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
        
        {/* MODAL EVENT MANAGEMENT */}
        {showEventModal && (
            <DynamicEventManagementModal
                data={eventModalData}
                onUpdateData={updateEventModalData}
                onClose={() => setShowEventModal(false)}
                onAction={handleEventAction}
                // Jika ingin menggunakan logika periodik bawaan dari modal:
                generateDatesForPeriod={generateDatesForPeriod}
            />
        )}
        
        {/* MODAL PREVIEW DOKUMEN */}
        {previewModalData && (
            <DynamicDocumentPreviewModal 
                data={previewModalData}
                onClose={closePreviewModal}
            />
        )}
        
        {/* MODAL KONFIRMASI / ALERT */}
        <ConfirmationModal data={confirmationModal} />

        {/* LOADING DOWNLOAD */}
        {(document.getElementById('download-loading') && true) && null}

      </main>
      
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