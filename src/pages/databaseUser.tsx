import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Download, X,  ChevronLeft, ChevronRight, BarChart3, Calendar,  Loader2, Eye } from "lucide-react"; 
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';
import { jsPDF } from 'jspdf';
import autoTable from "jspdf-autotable";
import type { UserOptions } from "jspdf-autotable";

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



type ViewMode = 'event_per_table' | 'monthly_summary';
type SelectedEventsByDate = Record<string, string[]>;
type EventsCache = Record<string, string[]>;

// --- UTILITY FUNCTIONS & CONSTANTS ---

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


const getAvailableSessionNames = (date: Date): string[] => {
    const dayOfWeek = date.getDay(); // 0 = Minggu, 6 = Sabtu
    if (dayOfWeek === 6) { // Sabtu
        return ["Ibadah Dewasa : Sabtu, 17:00", "Ibadah Lansia : Sabtu, 10:00"];
    } else if (dayOfWeek === 0) { // Minggu
        return ["Kebaktian I : 07:00", "Kebaktian II : 10:00", "Kebaktian III : 17:00", "Ibadah Anak : Minggu, 10:00", "Ibadah Remaja : Minggu, 10:00", "Ibadah Pemuda : Minggu, 10:00"];
    }
    return [];
};


const mockEventsGenerator = (dateKey: string, date: Date): string[] => {
    const defaultEvents = getAvailableSessionNames(date);
    
    const dateTimestamp = new Date(dateKey).setHours(0, 0, 0, 0);
    if (dateTimestamp <= todayStart && defaultEvents.length > 0) {
        // Tambahkan opsi 'KESELURUHAN DATA HARI INI'
        defaultEvents.unshift("KESELURUHAN DATA HARI INI");
    }
    return defaultEvents;
};

const getDatesWithEventsInMonth = (month: number, currentYear: number, currentEvents: EventsCache): { date: Date, key: string, events: string[] }[] => {
  const daysInMonth = getDaysInMonth(month, currentYear);
  const dates: { date: Date, key: string, events: string[] }[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, month, day);
    const dayKey = getDayKey(date);
    const dateTimestamp = new Date(date).setHours(0, 0, 0, 0);
    const isFutureDay = dateTimestamp > todayStart;

    if (!isFutureDay) {
      const mockEvents = mockEventsGenerator(dayKey, date);
      const currentEventList = currentEvents[dayKey] ?? mockEvents;
      
      if (currentEventList.length > 0) { 
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
}

const CalendarSection = ({
    year, setYear, startMonth, setStartMonth, viewMode, 
    handleSelectMonth, handleSelectDate, selectedDates, setShowYearDialog
}: CalendarSectionProps) => {

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
        for (let i = 0; i < 3; i++) {
          const monthIndex = (startMonth + i) % 12;
          months.push(monthIndex);
        }
        return months;
    }, [startMonth]);

    const selectedKeys = useMemo(() => new Set(selectedDates.map(getDayKey)), [selectedDates]);

    return (
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {monthsToDisplay.map((monthIndex) => {
                const daysInMonth = getDaysInMonth(monthIndex, year);
                const firstDay = getFirstDayOfMonth(monthIndex, year);
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
                        
                        const hasEvents = (memoryStorage.events[dayKey] ?? mockEventsGenerator(dayKey, thisDate)).length > 0;
                        
                        let dayClass = "relative p-1.5 rounded-full transition-all duration-150 text-xs md:text-sm";
                        if (isFutureDay) {
                          dayClass += " text-gray-300 cursor-not-allowed";
                        } else if (isSelected) {
                          dayClass += " bg-indigo-600 text-white font-bold cursor-pointer shadow-md"; 
                        } else { 
                          dayClass += " text-gray-700 hover:bg-indigo-200 cursor-pointer";
                        }

                        return (
                          <div 
                            key={i} 
                            className={dayClass} 
                            onClick={() => !isFutureDay && handleSelectDate(day, monthIndex)} 
                            role="button"
                          >
                            {day}
                            {hasEvents && !isFutureDay && (
                              <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-indigo-600'
                              }`}></div>
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
    // Semua fungsi terkait edit/add/delete event dihapus
    // handleDeleteEvent: (dateKey: string, eventName: string) => void;
    // handleOpenEditEvent: (dateKey: string, eventName: string) => void;
    // setShowAddEventDialog: React.Dispatch<React.SetStateAction<boolean>>;
    // setAddEventDateKey: React.Dispatch<React.SetStateAction<string | null>>;
}

const SelectedEventsSection = ({
    selectedDates, selectedEventsByDate, events, viewMode,
    handleSelectEvent,
    // Semua fungsi terkait edit/add/delete event dihapus dari props
}: SelectedEventsSectionProps) => {
    
    const selectedDateKeys = useMemo(() => selectedDates.map(getDayKey), [selectedDates]);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 lg:sticky lg:top-8 h-fit"> 
            <h3 className="text-lg font-bold text-indigo-700 mb-4 border-b pb-2">
              {selectedDates.length} Tanggal Dipilih ({viewMode === 'monthly_summary' ? '1 Tabel' : `${selectedDateKeys.reduce((acc, key) => acc + (selectedEventsByDate[key]?.length ?? 0), 0)} Event`})
            </h3>
            
            <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
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
                  const currentEvents = events[key] ?? mockEventsGenerator(key, date);
                  const selectedEvents = selectedEventsByDate[key] ?? [];
                  
                  return (
                    <div key={key} className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50"> 
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-800 text-sm">{dateDisplay}</span>
                        {/* Tombol + Event Dihapus */}
                        {/* <button 
                          className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition" 
                          onClick={() => { 
                            setShowAddEventDialog(true); 
                            setAddEventDateKey(key); 
                          }}
                        >
                          + Event
                        </button> */}
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
                                <div key={idx} className="relative inline-block">
                                    <button
                                        onClick={() => handleSelectEvent(key, ev)} 
                                        className={`text-xs px-3 py-1.5 rounded-lg transition 
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
                                    
                                    {/* Tombol Edit (Pencil) dan Hapus (X) Dihapus */}
                                    {/* {!isOverall && (
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
                                    )} */}
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
  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>((currentMonth - 1 + 12) % 12);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(Math.floor(currentYear / 10) * 10);
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<SelectedEventsByDate>({});
  const [events, setEvents] = useState<EventsCache>({});
  const [viewMode, setViewMode] = useState<ViewMode>('event_per_table');
  
  // Semua state terkait add/edit event dihapus
  // const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  // const [newEventName, setNewEventName] = useState('');
  // const [addEventDateKey, setAddEventDateKey] = useState<string | null>(null);
  // const [showEditEventDialog, setShowEditEventDialog] = useState(false); 
  // const [editEventName, setEditEventName] = useState(''); 
  // const [editingEventKey, setEditingEventKey] = useState<{ dateKey: string; oldName: string } | null>(null); 

  const [tablePage, setTablePage] = useState(1);
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false);
  const [formData, setFormData] = useState<Jemaat | null>(null); 
  const itemsPerPage = 10;
  
  const [filterStatusKehadiran, setFilterStatusKehadiran] = useState(""); 
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
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat"); 
        
        if (!res.ok) {
          throw new Error(`Gagal fetch data jemaat. Status: ${res.status}`);
        }

        const data: unknown = await res.json();
        
        if (Array.isArray(data) && data.length > 0) {
          const fetchedJemaat = data as Jemaat[];
          setJemaat(fetchedJemaat);
        } else {
          setJemaat([]);
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
        setJemaat([]); 
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);
  
  useEffect(() => {
    const newEvents: EventsCache = {};
    const months = [startMonth, (startMonth + 1) % 12, (startMonth + 2) % 12];
    
    months.forEach(month => {
        const datesInMonth = getDatesWithEventsInMonth(month, year, memoryStorage.events); 
        datesInMonth.forEach(d => {
            if (!memoryStorage.events[d.key]) { 
                newEvents[d.key] = d.events;
            }
        });
    });
    
    if (Object.keys(newEvents).length > 0) {
      setEvents(prev => ({ ...prev, ...newEvents }));
    }
  }, [startMonth, year]); 
  
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

    const datesWithEventsInMonth = getDatesWithEventsInMonth(monthIndex, currentYear, memoryStorage.events);
    
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
  }, [viewMode, startMonth, year, setStartMonth, setYear]);

  useEffect(() => {
    if (!router.isReady || isLoading || jemaat.length === 0) return; 

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
            const availableEvents = currentEventsCache[dateKey] ?? mockEventsGenerator(dateKey, dateObj); 
            
            currentEventsCache[dateKey] ??= availableEvents;

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
        
        const availableEvents = currentEventsCache[dateKey] ?? mockEventsGenerator(dateKey, targetDate); 
        currentEventsCache[dateKey] = availableEvents;
        
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
    
  }, [router, isLoading, jemaat.length, handleSelectMonth]); 

  const handleSelectDate = useCallback((day: number, month: number) => {
    setViewMode('event_per_table'); 
    
    const clickedDate = new Date(year, month, day);
    const key = getDayKey(clickedDate);
    const dateTimestamp = new Date(clickedDate).setHours(0, 0, 0, 0);
    const isFuture = dateTimestamp > todayStart;
    
    if (isFuture) return;

    const generatedEvents = mockEventsGenerator(key, clickedDate);
    const availableEvents = events[key] ?? generatedEvents;
    
    if (!events[key]) {
        setEvents(prev => ({ ...prev, [key]: generatedEvents }));
        memoryStorage.events[key] = generatedEvents;
    }

    const isCurrentlySelected = selectedDates.some(d => getDayKey(d) === key);
    
    let newDates: Date[];
    const newEventsByDate = { ...selectedEventsByDate };

    if (isCurrentlySelected) {
      newDates = selectedDates.filter(d => getDayKey(d) !== key);
      delete newEventsByDate[key];
    } else {
      newDates = [...selectedDates, clickedDate].sort((a, b) => a.getTime() - b.getTime());
      const overallEvent = availableEvents.find(e => e === "KESELURUHAN DATA HARI INI");
      newEventsByDate[key] = overallEvent ? [overallEvent] : []; 
    }
    
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
  }, [events, selectedDates, selectedEventsByDate, year]);

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
  
  // Fungsi-fungsi terkait event management dihapus
  /*
  const handleDeleteEvent = useCallback((dateKey: string, eventName: string) => { ... }, [selectedDates]);
  const handleOpenEditEvent = useCallback((dateKey: string, eventName: string) => { ... }, []);
  const handleSaveEditEvent = useCallback(() => { ... }, [editingEventKey, editEventName, selectedDates]);
  const handleAddEvent = useCallback(() => { ... }, [addEventDateKey, newEventName, events, selectedDates]);
  */
  
  const handleSelectYearFromGrid = useCallback((selectedYear: number) => {
    setYear(selectedYear);
    setShowYearDialog(false);
  }, []);
  
  const calculatedAge = useMemo(() => {
    return calculateAge(formData?.tanggalLahir);
  }, [formData?.tanggalLahir]);
  
  const getFilteredJemaatPerEvent = useCallback((jemaatList: Jemaat[], dateKey: string, event: string): Jemaat[] => {
    
    const dateObj = new Date(dateKey);

    let filteredData = jemaatList.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan)
    );
    
    // Logika untuk Monthly Summary atau Event 'KESELURUHAN BULAN INI'
    if (event === "KESELURUHAN BULAN INI") {
        if (filterKehadiranSesi !== "") {
            filteredData = filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        return filteredData;
    }
    
    // PERBAIKAN LOGIKA: Filter Jemaat berdasarkan Sesi yang tersedia di hari itu.
    if (event === "KESELURUHAN DATA HARI INI") {
        
        const availableSessions = getAvailableSessionNames(dateObj);
        
        // Jemaat yang berpotensi hadir di hari ini
        const jemaatPotentialyPresent = filteredData.filter(j => 
            availableSessions.includes(j.kehadiranSesi)
        );

        // Jika filter Kehadiran Sesi (Jenis Ibadah) diaktifkan, kita gunakan filter itu
        if (filterKehadiranSesi !== "") {
            // Filter hanya dari jemaat yang berpotensi hadir
            return jemaatPotentialyPresent.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        
        // Jika filter Kehadiran Sesi (Jenis Ibadah) tidak diaktifkan, kembalikan 
        // semua data yang sudah difilter Status/Jabatan DAN yang sesinya ada di hari itu.
        return jemaatPotentialyPresent; 
    }
    
    // Logika untuk event spesifik (misalnya 'Kebaktian I : 07:00')
    // Data yang muncul di event spesifik difilter berdasarkan KehadiranSesi yang sama dengan nama event.
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
        // Saat event_per_table, kita hanya ambil filter dari event pertama yang dipilih
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
    if (selectedTables.length === 0) {
        return [...new Set(jemaat.map((j) => j.kehadiranSesi))];
    }
    
    const uniqueSessions = new Set<string>();
    
    if (viewMode === 'monthly_summary') {
        return [...new Set(jemaat.map((j) => j.kehadiranSesi))];
    }
    
    if (selectedTables.length > 0) {
        const firstTable = selectedTables[0]; 

        if (firstTable && firstTable.event === 'KESELURUHAN DATA HARI INI') {
            const dateObj = new Date(firstTable.date);
            getAvailableSessionNames(dateObj).forEach(session => uniqueSessions.add(session));
        } else if (firstTable) {
            return [firstTable.event];
        }
    }
    
    return Array.from(uniqueSessions).sort();
  }, [jemaat, selectedTables, viewMode]);

  const handleRowClick = useCallback((row: Jemaat) => {
      setFormData({ ...row });
      setOpenDetailDrawer(true);
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
        alert("Tidak ada data untuk diunduh. Pilih tanggal dan event terlebih dahulu.");
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
            const dataForTable = viewMode === 'monthly_summary'
              ? getFilteredJemaatMonthlySummary(jemaat)
              : getFilteredJemaatPerEvent(jemaat, date, event);
            
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
              const dataForTable = viewMode === 'monthly_summary'
                ? getFilteredJemaatMonthlySummary(jemaat)
                : getFilteredJemaatPerEvent(jemaat, date, event);
              
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
        alert(`Gagal membuat laporan ${format.toUpperCase()}. Periksa konsol untuk detail error.`);
      } finally {
        const finalLoadingDiv = document.getElementById('download-loading');
        if (finalLoadingDiv) {
            document.body.removeChild(finalLoadingDiv);
        }
      }
  }, [tablesToRender, selectedDates, viewMode, startMonth, year, jemaat, getFilteredJemaatMonthlySummary, getFilteredJemaatPerEvent]);

  const showSesiFilter = useMemo(() => {
    if (viewMode === 'monthly_summary') return true;
    
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return true;
    }
    
    return false;
  }, [viewMode, selectedTables]);

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
    <div className="flex min-h-screen bg-gray-50"> 
      
      <div className="fixed top-0 left-0 h-full w-64 z-30"> 
        <Sidebar activeView='database' />
      </div>
      
      <main className="ml-64 flex-grow p-4 md:p-8 w-full"> 
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Data Kehadiran Jemaat (Read-Only)
          </h1>
          <div className="flex space-x-3">
            <button 
              onClick={() => setOpenDownloadDialog(true)}
              disabled={filteredCount === 0} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Download ({filteredCount})</span> 
            </button>
            <button 
              onClick={handleGoToStats}
              className="flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition shadow-md hover:shadow-lg"
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Statistik</span>
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
          />
          
          <SelectedEventsSection
            selectedDates={selectedDates}
            selectedEventsByDate={selectedEventsByDate}
            events={events}
            viewMode={viewMode}
            handleSelectEvent={handleSelectEvent}
            // Props terkait edit/add/delete event sudah dihapus
          />
        </div>

        {tablesToRender.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 flex-wrap mb-6"> 
              <span className="font-semibold text-gray-700 text-sm">Filter:</span>
              
              <select 
                value={filterStatusKehadiran} 
                onChange={e => setFilterStatusKehadiran(e.target.value)}
                className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Semua Status Kehadiran</option>
                <option value="Aktif">Aktif</option>
                <option value="Jarang Hadir">Jarang Hadir</option>
                <option value="Tidak Aktif">Tidak Aktif</option>
              </select>
              
              <select 
                value={filterJabatan} 
                onChange={e => setFilterJabatan(e.target.value)}
                className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Semua Jenis Ibadah</option>
                    {uniqueKehadiranSesiByDate.map((sesi) => (
                      <option key={sesi} value={sesi}>{sesi}</option>
                    ))}
                  </select>
              )}
              
            </div>
            
            <div className="space-y-8" id="table-container"> 
              
              {tablesToRender.map(({ date, event }, idx) => {
                
                const dataToRender = viewMode === 'monthly_summary'
                    ? getFilteredJemaatMonthlySummary(jemaat)
                    : getFilteredJemaatPerEvent(jemaat, date, event);
                    
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
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Foto</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status Kehadiran</th> 
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jabatan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jenis Ibadah/Kebaktian</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
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
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center font-medium">
                                  {rowIndex + 1}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">
                                  {j.id}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <Image
                                    src={j.foto}
                                    alt={j.nama}
                                    width={40}
                                    height={40}
                                    className="rounded-full h-10 w-10 object-cover shadow-sm"
                                    unoptimized
                                  />
                                </td>
                                
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {j.nama}
                                </td>
                                
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
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
                                
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {j.jabatan}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {j.kehadiranSesi}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      handleRowClick(j); 
                                    }}
                                    className="px-3 py-1.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-xs font-medium flex items-center gap-1 mx-auto" 
                                  >
                                    <Eye size={14} />
                                    Lihat
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {showPagination && (
                      <div className="flex justify-center items-center gap-4 p-4 border-t bg-gray-50">
                        <button 
                          disabled={tablePage === 1}
                          onClick={() => setTablePage(p => p - 1)}
                          className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition" 
                        >
                          Sebelumnya
                        </button>
                        <span className="text-gray-700 font-medium">
                          Halaman <span className="text-indigo-600 font-bold">{tablePage}</span> dari {totalPages}
                        </span>
                        <button 
                          disabled={tablePage === totalPages}
                          onClick={() => setTablePage(p => p + 1)}
                          className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition" 
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
                      ${y > currentYear ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    disabled={y > currentYear}
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
        
        {/* showAddEventDialog dihapus */}
        
        {/* showEditEventDialog dihapus */}

        {openDetailDrawer && formData && (
          <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
            <div className="bg-white w-full max-w-md h-full overflow-y-auto animate-slide-in"> 
              <div className="p-6">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                  <h2 className="text-2xl font-bold text-indigo-700">Detail Jemaat (Read-Only)</h2>
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
                        src={formData.foto}
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