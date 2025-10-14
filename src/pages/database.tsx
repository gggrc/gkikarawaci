import { useEffect, useState, useMemo } from "react";
import { Download, X, Settings, ChevronLeft, ChevronRight, BarChart3, Calendar, ListChecks, CheckCheck } from "lucide-react";
import Sidebar from "~/components/Sidebar"; 
import { useRouter } from 'next/router';

// --- Tipe Data ---
interface Jemaat {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  status: string;
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif";
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string; // Jenis Ibadah/Kebaktian
}

interface EditableJemaat extends Jemaat {}

// --- Utility function for Age Calculation ---
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

// --- Konstanta Kalender ---
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

const getMonthKey = (date: Date): string => 
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Helper untuk in-memory storage
let memoryStorage: { 
  selectedDates: string[], 
  selectedEventsByDate: Record<string, string[]>, 
  events: Record<string, string[]> 
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

const saveSelection = (dates: Date[], events: Record<string, string[]>) => {
  const datesToStore = dates.map(getDayKey);
  memoryStorage.selectedDates = datesToStore;
  memoryStorage.selectedEventsByDate = events;
};

// --- Fungsi utilitas Murni ---
const mockEventsGenerator = (dateKey: string, date: Date): string[] => {
    const dayOfWeek = date.getDay();
    let defaultEvents: string[] = [];
    if (dateKey && dateKey) {
        if (dayOfWeek === 6) {
            defaultEvents = ["Ibadah Dewasa : Sabtu, 17:00", "Ibadah Lansia : Sabtu, 10:00"];
        } else if (dayOfWeek === 0) {
            defaultEvents = ["Kebaktian I : 07:00", "Kebaktian II : 10:00", "Kebaktian III : 17:00", "Ibadah Anak : Minggu, 10:00", "Ibadah Remaja : Minggu, 10:00", "Ibadah Pemuda : Minggu, 10:00"];
        }
    }
    // Tambahkan KESELURUHAN DATA HARI INI di awal daftar event jika ada event lain
    if (defaultEvents.length > 0) {
        defaultEvents.unshift("KESELURUHAN DATA HARI INI");
    }
    return defaultEvents;
};

const getDaysInMonth = (month: number, year: number): number => 
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (month: number, year: number): number => 
  new Date(year, month, 1).getDay();

// Helper untuk mendapatkan tanggal-tanggal ibadah dalam sebulan
const getDatesWithEventsInMonth = (month: number, currentYear: number, currentEvents: Record<string, string[]>): { date: Date, key: string, events: string[] }[] => {
  const daysInMonth = getDaysInMonth(month, currentYear);
  const dates: { date: Date, key: string, events: string[] }[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, month, day);
    const dayKey = getDayKey(date);
    const isFutureDay = date.setHours(0, 0, 0, 0) > todayStart;

    if (!isFutureDay) {
      const mockEvents = mockEventsGenerator(dayKey, date);
      const currentEventList = currentEvents[dayKey] || mockEvents;
      
      if (mockEvents.length > 0) { 
        dates.push({ date, key: dayKey, events: currentEventList });
      }
    }
  }
  return dates;
};

// --- LOGIKA UTAMA DATABASE PAGE ---
export default function DatabasePage() {
  const router = useRouter();
  const [jemaat, setJemaat] = useState<Jemaat[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  
  // Kalender state
  const [year, setYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>((currentMonth - 1 + 12) % 12);
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [gridStartYear, setGridStartYear] = useState(Math.floor(currentYear / 10) * 10);
  
  // Selection state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<Record<string, string[]>>({});
  const [events, setEvents] = useState<Record<string, string[]>>({});
  
  // State untuk Mode Tampilan Tabel
  const [viewMode, setViewMode] = useState<'event_per_table' | 'monthly_summary'>('event_per_table');
  
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [addEventDateKey, setAddEventDateKey] = useState<string | null>(null);

  // Tabel state
  const [tablePage, setTablePage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [draftJemaat, setDraftJemaat] = useState<EditableJemaat[]>([]);
  const [openDetailDrawer, setOpenDetailDrawer] = useState(false);
  const [formData, setFormData] = useState<Jemaat | null>(null);
  const itemsPerPage = 10;
  // Filter state
  const [filterStatusKehadiran, setFilterStatusKehadiran] = useState(""); 
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  // NEW STATE: Filter Kehadiran Sesi
  const [filterKehadiranSesi, setFilterKehadiranSesi] = useState(""); 
  
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false);

  // Load initial selection
  useEffect(() => {
    const initialSelection = loadSelection();
    setSelectedDates(initialSelection.dates);
    setSelectedEventsByDate(initialSelection.events);
    setEvents(memoryStorage.events || {});
  }, []);

  // Perbaikan Fetching Data Jemaat dari /api/jemaat
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/jemaat"); 
        
        if (!res.ok) {
          throw new Error(`Gagal fetch data jemaat. Status: ${res.status}`);
        }

        const data: unknown = await res.json();
        
        if (Array.isArray(data) && data.length > 0 && 
            typeof (data[0] as Jemaat).statusKehadiran === 'string' &&
            typeof (data[0] as Jemaat).nama === 'string'
        ) {
          const fetchedJemaat = data as Jemaat[];
          setJemaat(fetchedJemaat);
          setDraftJemaat(fetchedJemaat.map(j => ({ ...j })));
        } else {
          throw new Error("Data jemaat tidak valid atau kosong.");
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);
  
  // Gunakan useEffect untuk mengisi events cache
  useEffect(() => {
    const newEvents: Record<string, string[]> = {};
    const months = [startMonth, (startMonth + 1) % 12, (startMonth + 2) % 12];
    
    months.forEach(month => {
        const datesInMonth = getDatesWithEventsInMonth(month, year, events); 
        datesInMonth.forEach(d => {
            if (!events[d.key]) { 
                newEvents[d.key] = d.events;
            }
        });
    });
    
    if (Object.keys(newEvents).length > 0) {
      setEvents(prev => ({ ...prev, ...newEvents }));
    }
  }, [startMonth, year, events]);
  
  // Sync events to memory storage
  useEffect(() => {
    memoryStorage.events = events;
  }, [events]);

  // SELECTED TABLES: Pasangan {date, event} untuk render multiple tables (hanya dipakai di mode event_per_table)
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
  
  // Digunakan untuk download dan summary count
  const selectedDatesOnly = useMemo(() => selectedDates.map(getDayKey), [selectedDates]);

  // Reset pagination when filters change
  useEffect(() => {
    setTablePage(1);
  }, [filterStatusKehadiran, filterJabatan, filterStatus, filterKehadiranSesi, selectedDates, viewMode]); 

  // Handle URL Query Parameters (kembali ke logika single table/single date)
  useEffect(() => {
    if (!router.isReady || jemaat.length === 0 || Object.keys(events).length === 0) return; 

    const { date } = router.query;
    if (typeof date !== 'string') return;
    
    let targetDate = new Date(date);
    
    const triggerSelection = (dateKey: string, m: number, y: number) => {
        const availableEvents = events[dateKey] || mockEventsGenerator(dateKey, targetDate); 
        setEvents(prev => ({ ...prev, [dateKey]: availableEvents }));
        
        const selectedEvents = availableEvents.filter(e => e === "KESELURUHAN DATA HARI INI"); 
        
        setSelectedDates([targetDate]);
        setSelectedEventsByDate({ [dateKey]: selectedEvents });
        setStartMonth(m);
        setYear(y);
        setViewMode('event_per_table'); // Default mode saat navigasi single date
    }
    
    if (date.length === 7) { 
        const y = parseInt(date.substring(0, 4), 10);
        const m = parseInt(date.substring(5, 7), 10) - 1;
        targetDate = new Date(y, m, 1);
        
        // Panggil handleSelectMonth untuk seleksi bulanan
        handleSelectMonth(m, y, true); // True untuk force monthly summary
    } 
    else if (!isNaN(targetDate.getTime())) {
        const dateKey = getDayKey(targetDate);
        triggerSelection(dateKey, targetDate.getMonth(), targetDate.getFullYear());
    }
    
    router.replace(router.pathname, undefined, { shallow: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query, jemaat.length, Object.keys(events).length]);

  // LOGIKA KALENDER: Seleksi Bulan (Monthly Summary Mode)
  const handleSelectMonth = (monthIndex: number, currentYear: number, forceMonthlySummary = false) => {
    
    if (viewMode === 'monthly_summary' && !forceMonthlySummary) {
        // Jika sedang di mode monthly summary dan klik bulan yang sama lagi, kembali ke mode event per table
        setViewMode('event_per_table');
        // Kosongkan seleksi atau biarkan default seleksi tanggal 1
        setSelectedDates([]);
        setSelectedEventsByDate({});
        saveSelection([], {});
        return;
    }

    const datesWithEventsInMonth = getDatesWithEventsInMonth(monthIndex, currentYear, events);
    
    const newDates = datesWithEventsInMonth.map(d => d.date);
    const newEventsByDate: Record<string, string[]> = {};
    
    datesWithEventsInMonth.forEach(d => {
        // Otomatis pilih KESELURUHAN DATA HARI INI untuk semua tanggal
        const overallEvent = d.events.find(e => e === "KESELURUHAN DATA HARI INI");
        newEventsByDate[d.key] = overallEvent ? [overallEvent] : [];
    });

    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
    
    setStartMonth(monthIndex);
    setYear(currentYear);
    setViewMode('monthly_summary');
  };
    
  // Logika select date (Mengubah mode ke event_per_table)
  const handleSelectDate = (day: number, month: number) => {
    setViewMode('event_per_table'); // Pindah ke mode multiple tables saat tanggal diklik
    
    const clickedDate = new Date(year, month, day);
    const key = getDayKey(clickedDate);
    const isFuture = new Date(clickedDate).setHours(0, 0, 0, 0) > todayStart;
    
    if (isFuture) return;

    const generatedEvents = mockEventsGenerator(key, clickedDate);
    const availableEvents = events[key] || generatedEvents;
    
    if (!events[key]) {
        setEvents(prev => ({ ...prev, [key]: generatedEvents }));
    }

    const isCurrentlySelected = selectedDates.some(d => getDayKey(d) === key);
    
    let newDates: Date[];
    let newEventsByDate = { ...selectedEventsByDate };

    if (isCurrentlySelected) {
      newDates = selectedDates.filter(d => getDayKey(d) !== key);
      delete newEventsByDate[key];
    } else {
      newDates = [...selectedDates, clickedDate].sort((a, b) => a.getTime() - b.getTime());
      // Otomatis pilih KESELURUHAN DATA HARI INI saat tanggal diklik
      const overallEvent = availableEvents.find(e => e === "KESELURUHAN DATA HARI INI");
      newEventsByDate[key] = overallEvent ? [overallEvent] : []; 
    }
    
    setSelectedDates(newDates);
    setSelectedEventsByDate(newEventsByDate);
    saveSelection(newDates, newEventsByDate);
  };

  // LOGIKA UTAMA MULTIPLE SELECTION EVENT
  const handleSelectEvent = (dateKey: string, event: string) => {
    setViewMode('event_per_table'); // Pindah ke mode multiple tables saat event di panel kanan diklik
    
    setSelectedEventsByDate(prev => {
      const current = prev[dateKey] ?? [];
      const isEventSelected = current.includes(event);
      
      let updated: string[];
      
      if (event === "KESELURUHAN DATA HARI INI") {
          // Jika KESELURUHAN di-klik:
          if (isEventSelected) {
              updated = current.filter(e => e !== event);
          } else {
              updated = [...current, event];
          }
      } else {
          // Jika event spesifik di-klik:
          if (isEventSelected) {
              updated = current.filter((e: string) => e !== event);
          } else {
              updated = [...current, event];
          }
      }
      
      const newEventsByDate = { ...prev, [dateKey]: updated.filter(e => e) };
      saveSelection(selectedDates, newEventsByDate);

      return newEventsByDate;
    });
  };
  
  // NEW FUNCTION: Handle Hapus Event (HANYA event non-mock yang bisa dihapus)
  const handleDeleteEvent = (dateKey: string, eventName: string) => {
      // Periksa apakah event adalah event mock default atau event KESELURUHAN
      const date = new Date(dateKey);
      const mockEvents = mockEventsGenerator(dateKey, date);
      // Event mock adalah event yang ada di daftar mock events tapi BUKAN KESELURUHAN
      const isMockEvent = mockEvents.includes(eventName) && eventName !== "KESELURUHAN DATA HARI INI";
      
      if (isMockEvent || eventName === "KESELURUHAN DATA HARI INI") return; // Jangan hapus event utama atau event mock
      
      // Konfirmasi penghapusan (Opsional, tapi disarankan)
      if (!confirm(`Apakah Anda yakin ingin menghapus event "${eventName}" dari tanggal ${new Date(dateKey).toLocaleDateString("id-ID")}?`)) {
          return;
      }
      
      // Hapus dari daftar events
      setEvents(prevEvents => {
          const updatedEvents = {
              ...prevEvents,
              [dateKey]: (prevEvents[dateKey] || []).filter(e => e !== eventName)
          };
          memoryStorage.events = updatedEvents;
          return updatedEvents;
      });
      
      // Hapus dari daftar selected events
      setSelectedEventsByDate(prevSelected => {
          const newSelected = {
              ...prevSelected,
              [dateKey]: (prevSelected[dateKey] || []).filter(e => e !== eventName)
          };
          saveSelection(selectedDates, newSelected);
          return newSelected;
      });
  };

  
  const handleAddEvent = () => {
    const key = addEventDateKey;
    if (!key || !newEventName.trim()) return;
    
    setViewMode('event_per_table');
    
    const trimmedName = newEventName.trim();
    
    // Pastikan KESELURUHAN selalu ada di awal daftar
    const currentEvents = events[key] ?? mockEventsGenerator(key, new Date(key));
    const newEvents = ["KESELURUHAN DATA HARI INI", ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI" && e !== trimmedName), trimmedName];
    
    setEvents(prevEvents => {
      const updatedEvents = { ...prevEvents, [key]: newEvents };
      memoryStorage.events = updatedEvents;
      return updatedEvents;
    });
    
    setSelectedEventsByDate(prev => {
      const currentSelected = prev[key] ?? [];
      
      // Tambahkan event baru ke yang sudah dipilih
      const newSelected = [...currentSelected, trimmedName];
      
      const newEventsByDate = { ...prev, [key]: newSelected.filter(e => e) };
      saveSelection(selectedDates, newEventsByDate);
      return newEventsByDate;
    });
    
    if (!selectedDates.some(d => getDayKey(d) === key)) {
      setSelectedDates(prev => [...prev, new Date(key)].sort((a, b) => a.getTime() - b.getTime()));
    }
    
    setShowAddEventDialog(false);
    setNewEventName('');
    setAddEventDateKey(null);
  };
  
  const handlePrevMonth = () => { 
    const newMonth = (startMonth - 1 + 12) % 12;
    const newYear = startMonth === 0 ? year - 1 : year;
    
    setStartMonth(newMonth); 
    setYear(newYear);
    
    // Pindah ke mode monthly summary saat pindah bulan
    handleSelectMonth(newMonth, newYear, true); 
  };
  
  const handleNextMonth = () => { 
    const newMonth = (startMonth + 1) % 12;
    const newYear = startMonth === 11 ? year + 1 : year;
    
    setStartMonth(newMonth); 
    setYear(newYear); 
    
    // Pindah ke mode monthly summary saat pindah bulan
    handleSelectMonth(newMonth, newYear, true); 
  };
  
  const monthsToDisplay = useMemo(() => {
    const months = [];
    for (let i = 0; i < 3; i++) {
      const monthIndex = (startMonth + i) % 12;
      months.push(monthIndex);
    }
    return months;
  }, [startMonth]);
  
  const handleOpenYearPicker = () => {
    setShowYearDialog(true);
    setGridStartYear(Math.floor(year / 10) * 10);
  };

  const handleSelectYearFromGrid = (selectedYear: number) => {
    setYear(selectedYear);
    setShowYearDialog(false);
    
    // Pindah ke mode monthly summary saat pilih tahun
    handleSelectMonth(startMonth, selectedYear, true); 
  };
  
  const calculatedAge = useMemo(() => {
    return calculateAge(formData?.tanggalLahir);
  }, [formData?.tanggalLahir]);
  
  // Fungsi Filter untuk mode event_per_table (menerima pasangan {date, event})
  const getFilteredJemaatPerEvent = (jemaatList: Jemaat[], dateKey: string, event: string): Jemaat[] => {
    // 1. Filter berdasarkan filter UI
    let filteredData = jemaatList.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan) &&
      (filterStatus === "" || j.status === filterStatus)
    );
    
    // 2. Filter berdasarkan Event yang sedang di-render
    if (event === "KESELURUHAN DATA HARI INI") {
        return filteredData;
    }
    
    // Jika event spesifik yang dipilih:
    return filteredData.filter(j => j.kehadiranSesi === event);
  };

  // Fungsi Filter untuk mode monthly_summary (menggabungkan semua data)
  const getFilteredJemaatMonthlySummary = (jemaatList: Jemaat[]): Jemaat[] => {
    if (selectedDatesOnly.length === 0) return [];

    // Filter UI
    let filteredData = jemaatList.filter(j =>
      (filterStatusKehadiran === "" || j.statusKehadiran === filterStatusKehadiran) &&
      (filterJabatan === "" || j.jabatan === filterJabatan) &&
      (filterStatus === "" || j.status === filterStatus)
    );
    
    // Filter NEW: Berdasarkan Kehadiran Sesi
    if (filterKehadiranSesi !== "") {
        filteredData = filteredData.filter(j => j.kehadiranSesi === filterKehadiranSesi);
    }

    // Karena ini adalah mock data, kita menganggap semua jemaat yang difilter UI adalah
    // data untuk seluruh bulan.
    return filteredData;
  }
  
  // Fungsi utama yang dipanggil oleh render (digunakan untuk download dan pagination)
  const getFilteredJemaat = (jemaatList: Jemaat[]): Jemaat[] => {
    if (viewMode === 'monthly_summary') {
        return getFilteredJemaatMonthlySummary(jemaatList);
    }
    
    // Untuk mode 'event_per_table', kita gunakan data dari tabel pertama untuk pagination.
    if (selectedTables.length > 0) {
        return getFilteredJemaatPerEvent(jemaatList, selectedTables[0].date, selectedTables[0].event);
    }

    return [];
  }
  
  const getPagedData = (jemaatList: Jemaat[]) => {
    const filtered = jemaatList; 
    const indexOfLast = tablePage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return filtered.slice(indexOfFirst, indexOfLast);
  };
  
  const uniqueJabatan = useMemo(() => 
    [...new Set(jemaat.map((j) => j.jabatan))], [jemaat]);
    
  // NEW: Ambil semua Sesi unik untuk filter
  const uniqueKehadiranSesi = useMemo(() => 
    [...new Set(jemaat.map((j) => j.kehadiranSesi))], [jemaat]);

  const handleSaveEdit = () => {
    setEditMode(false);
    setJemaat(draftJemaat.map(d => ({ ...d })));
  };
  
  const handleCancelEdit = () => {
    setEditMode(false);
    setDraftJemaat(jemaat.map(j => ({ ...j })));
  };
  
  const handleRowClick = (row: Jemaat) => {
    if (!editMode) {
      setFormData({ ...row });
      setOpenDetailDrawer(true);
    }
  };
  
  const handleSaveForm = () => {
    if (formData) {
        let updatedFormData = { ...formData };
        
        if (updatedFormData.tanggalLahir) {
            updatedFormData.umur = calculateAge(updatedFormData.tanggalLahir);
        } else {
            updatedFormData.umur = undefined;
        }

        setJemaat(prev => prev.map(j => j.id === updatedFormData.id ? updatedFormData : j));
        setDraftJemaat(prev => prev.map(j => j.id === updatedFormData.id ? updatedFormData : j));
        setOpenDetailDrawer(false);
    }
  };

  const handleDownload = (format: 'csv' | 'pdf') => {
    const dataToDownload = getFilteredJemaat(jemaat);
    if (dataToDownload.length === 0) {
        alert("Tidak ada data untuk diunduh.");
        return;
    }
    
    const dateRange = selectedDates.length > 0 
      ? `${new Date(selectedDates[0]).toLocaleDateString('id-ID')} sampai ${new Date(selectedDates[selectedDates.length - 1]).toLocaleDateString('id-ID')}`
      : "N/A";
      
    const summaryHeader = viewMode === 'monthly_summary'
      ? `Data Gabungan Bulanan: ${monthNames[startMonth]} ${year}`
      : `Data Gabungan Filtered untuk Tanggal: ${dateRange}`;

    if (format === 'csv') {
      let csv = "";
      
      csv += `"${summaryHeader}"\n`;
      
      const keys = ['id', 'nama', 'statusKehadiran', 'jabatan', 'status', 'kehadiranSesi', 'email', 'telepon'];
      const headers = keys.join(",");
      csv += headers + "\n";
      
      csv += dataToDownload.map(row => 
        keys.map(key => {
          const val = row[key as keyof Jemaat] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`; 
        }).join(",")
      ).join("\n") + "\n";
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", "data_jemaat_gabungan_filtered.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'pdf') {
      // Mock PDF download
      alert(`Simulasi Download PDF untuk: ${summaryHeader}\n\nFitur ini memerlukan library eksternal (seperti jsPDF) untuk implementasi penuh.`);
    }
    setOpenDownloadDialog(false);
  };

  // Hitungan untuk pagination (berdasarkan mode)
  const dataForPagination = getFilteredJemaat(jemaat);
  const filteredCount = dataForPagination.length;
  const totalPages = Math.ceil(filteredCount / itemsPerPage);

  const currentYearForGrid = new Date().getFullYear();
  const years = useMemo(() => {
    const startYear = currentYearForGrid - 5;
    const endYear = currentYearForGrid + 1;
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, [currentYearForGrid]);
  
  // Ringkasan untuk Header Tabel Tunggal (Monthly Summary Mode)
  const monthlySummaryHeader = useMemo(() => {
    if (selectedDates.length === 0) return "Pilih Tanggal";
    
    const dateCount = selectedDates.length;
    
    return `Keseluruhan Data | ${monthNames[startMonth]} ${year} (${dateCount} Tanggal)`;
  }, [selectedDates, startMonth, year]);

  const tablesToRender = useMemo(() => {
    if (viewMode === 'monthly_summary') {
      if (selectedDatesOnly.length === 0) return [];
      return [{ date: getDayKey(new Date(year, startMonth, 1)), event: 'KESELURUHAN BULAN INI' }];
    } else {
      return selectedTables;
    }
  }, [viewMode, selectedTables, selectedDatesOnly, startMonth, year]);


  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <main className="flex-grow p-8 max-w-7xl mx-auto w-full flex justify-center items-center">
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
            Data Kehadiran Jemaat
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
              onClick={() => router.push('/statistic')}
              className="flex items-center gap-2 px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition shadow-md hover:shadow-lg"
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">Statistik</span>
            </button>
          </div>
        </div>
      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-indigo-700 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              Pilih Tanggal Ibadah
            </h2>
            
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <button 
                  onClick={handlePrevMonth} 
                  className="rounded-full p-2 text-indigo-600 hover:bg-indigo-100 transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                
                <div className="flex items-center gap-3">
                    <h2 
                      className={`text-xl md:text-2xl font-bold text-gray-800 cursor-pointer hover:text-indigo-600 transition px-4 py-2 rounded-lg ${
                        viewMode === 'monthly_summary' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'hover:bg-indigo-100'
                      }`}
                      onClick={handleOpenYearPicker}
                    >
                      Tahun {year}
                    </h2>
                </div>
                
                <button 
                  onClick={handleNextMonth} 
                  className="rounded-full p-2 text-indigo-600 hover:bg-indigo-100 transition"
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
                  ...Array(startDayOffset).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                
                const selectedKeys = new Set(selectedDates.map(getDayKey));
                  
                return (
                  <div key={`${year}-${monthIndex}`} className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-100">
                    <h4 
                      className="mb-3 text-center text-sm md:text-md font-bold text-indigo-600 cursor-pointer hover:text-indigo-800 transition"
                      onClick={() => handleSelectMonth(monthIndex, year)} // KLIK BULAN UNTUK SELEKSI BULANAN (monthly summary)
                    >
                      {monthNames[monthIndex]} {year}
                    </h4>
                    <div className="grid grid-cols-7 text-xs font-semibold text-gray-600 mb-2">
                      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                        <div key={d} className="text-center">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                      {daysArray.map((day, i) => {
                        if (day === null) return <div key={i} className="p-1"></div>;
                        
                        const thisDate = new Date(year, monthIndex, day);
                        const dayKey = getDayKey(thisDate);
                        const isSelected = selectedKeys.has(dayKey);
                        const isFutureDay = new Date(thisDate).setHours(0, 0, 0, 0) > todayStart;
                        
                        const hasEvents = mockEventsGenerator(dayKey, thisDate).length > 0;
                        
                        let dayClass = "relative p-1.5 rounded-full transition-all duration-150 text-xs md:text-sm";
                        if (isFutureDay) {
                          dayClass += " text-gray-300 cursor-not-allowed";
                        } else if (isSelected) {
                          dayClass += " bg-indigo-600 text-white font-bold shadow-md ring-2 ring-indigo-300 cursor-pointer";
                        } else { 
                          dayClass += " text-gray-700 hover:bg-indigo-200 cursor-pointer";
                        }

                        return (
                          <div 
                            key={i} 
                            className={dayClass} 
                            onClick={() => !isFutureDay && handleSelectDate(day, monthIndex)} // KLIK TANGGAL (event_per_table)
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
          
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 lg:sticky lg:top-8 h-fit">
            <h3 className="text-lg font-bold text-indigo-700 mb-4 border-b pb-2">
              {selectedDates.length} Tanggal Dipilih ({viewMode === 'monthly_summary' ? '1 Tabel' : `${selectedTables.length} Tabel`})
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
                  const mockEvents = mockEventsGenerator(key, date); // Ulangi mockEvents untuk cek isMockEvent
                  
                  return (
                    <div key={key} className="p-4 border-2 border-indigo-200 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-800 text-sm">{dateDisplay}</span>
                        <button 
                          className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-sm"
                          onClick={() => { 
                            setShowAddEventDialog(true); 
                            setAddEventDateKey(key); 
                          }}
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
                            {currentEvents.map((ev, idx) => (
                              <div key={idx} className="relative inline-block">
                                <button
                                  onClick={() => handleSelectEvent(key, ev)} // KLIK EVENT (event_per_table)
                                  className={`text-xs px-3 py-1.5 rounded-lg transition shadow-sm 
                                ${ev === "KESELURUHAN DATA HARI INI" 
                                  ? selectedEvents.includes(ev) 
                                    ? 'bg-green-600 text-white shadow-md' 
                                    : 'border-2 border-green-300 text-green-700 hover:bg-green-100'
                                  : selectedEvents.includes(ev)
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                                }`}
                                >
                                  {ev}
                                </button>
                                {/* Tombol Hapus: Hanya untuk event non-mock dan non-KESELURUHAN */}
                                {ev !== "KESELURUHAN DATA HARI INI" && !mockEvents.includes(ev) && (
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
                                )}
                              </div>
                            ))}
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
        </div>

        {tablesToRender.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex-wrap mb-6">
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
              
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Tidak Aktif">Tidak Aktif</option>
              </select>
              
              {/* NEW FILTER: Jenis Ibadah/Kebaktian */}
              {viewMode === 'monthly_summary' && (
                  <select 
                    value={filterKehadiranSesi} 
                    onChange={e => setFilterKehadiranSesi(e.target.value)}
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Semua Jenis Ibadah</option>
                    {uniqueKehadiranSesi.map((sesi) => (
                      <option key={sesi} value={sesi}>{sesi}</option>
                    ))}
                  </select>
              )}
              
              <div className="flex-grow flex justify-end gap-2">
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition shadow-md hover:shadow-lg"
                  >
                    <Settings size={18} />
                    <span className="hidden sm:inline">Edit Data</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md"
                    >
                      ✓ Simpan
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition"
                    >
                      ✕ Batal
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-8">
              
              {tablesToRender.map(({ date, event }, idx) => {
                
                const dataToRender = viewMode === 'monthly_summary'
                    ? getFilteredJemaatMonthlySummary(jemaat)
                    : getFilteredJemaatPerEvent(jemaat, date, event);
                    
                const filteredData = dataToRender;
                
                // Pagination hanya untuk tabel pertama
                const pagedData = idx === 0 ? getPagedData(filteredData) : filteredData; 
                
                const tableFilteredCount = filteredData.length;
                
                // Pagination hanya ditampilkan pada tabel pertama (index 0)
                const showPagination = idx === 0 && totalPages > 1;

                const headerText = viewMode === 'monthly_summary'
                    ? `📋 ${monthlySummaryHeader}`
                    : `📋 ${new Date(date).toLocaleDateString("id-ID", { 
                        day: "2-digit", 
                        month: "long", 
                        year: "numeric" 
                      })} - ${event}`;

                return (
                  <div key={date + event} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white font-semibold flex justify-between items-center">
                      <h2 className="text-base md:text-lg">{headerText}</h2>
                      <span className="text-sm bg-white/20 px-3 py-1 rounded-full">{tableFilteredCount} data</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
                          <tr>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Foto</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status Kehadiran</th> 
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jabatan</th>
                            {/* NEW COLUMN: Jenis Ibadah/Kebaktian */}
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Jenis Ibadah/Kebaktian</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pagedData.map((j, i) => {
                            const draftItem = draftJemaat.find(d => d.id === j.id) ?? j;
                            // Index hanya valid untuk tabel pertama jika pagination diaktifkan
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
                                  <img 
                                    src={j.foto} 
                                    alt={j.nama} 
                                    className="rounded-full h-10 w-10 object-cover ring-2 ring-indigo-300 shadow-sm" 
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {editMode ? (
                                    <input
                                      type="text"
                                      value={draftItem.nama}
                                      onChange={(e) => {
                                        setDraftJemaat(prev => 
                                          prev.map(d => d.id === j.id ? { ...d, nama: e.target.value } : d)
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 w-full focus:border-indigo-500 focus:outline-none"
                                    />
                                  ) : (
                                    j.nama
                                  )}
                                </td>
                                
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  {editMode ? (
                                    <select
                                      value={draftItem.statusKehadiran}
                                      onChange={(e) => {
                                        setDraftJemaat(prev => 
                                          prev.map(d => d.id === j.id ? { ...d, statusKehadiran: e.target.value as Jemaat['statusKehadiran'] } : d)
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none"
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
                                
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {editMode ? (
                                    <select
                                      value={draftItem.jabatan}
                                      onChange={(e) => {
                                        setDraftJemaat(prev => 
                                          prev.map(d => d.id === j.id ? { ...d, jabatan: e.target.value } : d)
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none"
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
                                {/* NEW COLUMN VALUE */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {draftItem.kehadiranSesi}
                                </td>
                                {/* END NEW COLUMN VALUE */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  {editMode ? (
                                    <select
                                      value={draftItem.status}
                                      onChange={(e) => {
                                        setDraftJemaat(prev => 
                                          prev.map(d => d.id === j.id ? { ...d, status: e.target.value } : d)
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-2 border-indigo-300 rounded px-2 py-1 focus:border-indigo-500 focus:outline-none"
                                    >
                                      <option value="Aktif">Aktif</option>
                                      <option value="Tidak Aktif">Tidak Aktif</option>
                                    </select>
                                  ) : (
                                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm ${
                                      j.status === "Aktif" 
                                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                    }`}>
                                      {j.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      handleRowClick(j); 
                                    }}
                                    className="px-3 py-1.5 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-xs font-medium shadow-sm"
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
                      <div className="flex justify-center items-center gap-4 p-4 border-t bg-gray-50">
                        <button 
                          disabled={tablePage === 1}
                          onClick={() => setTablePage(p => p - 1)}
                          className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                        >
                          ← Sebelumnya
                        </button>
                        <span className="text-gray-700 font-medium">
                          Halaman <span className="text-indigo-600 font-bold">{tablePage}</span> dari {totalPages}
                        </span>
                        <button 
                          disabled={tablePage === totalPages}
                          onClick={() => setTablePage(p => p + 1)}
                          className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition shadow-sm"
                        >
                          Berikutnya →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300">
            <Calendar size={64} className="text-gray-300 mb-4" />
            <p className="text-xl text-gray-500 mb-2">Belum ada data yang ditampilkan</p>
            <p className="text-sm text-gray-400">Pilih tanggal di kalender dan minimal 1 event</p>
          </div>
        )}

        {showYearDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
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
                {Array.from({ length: 10 }, (_, i) => gridStartYear + i).map((y) => (
                  <button
                    key={y}
                    onClick={() => handleSelectYearFromGrid(y)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg transition duration-150 shadow-sm
                      ${y === year
                        ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400'
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
                  onClick={() => setShowYearDialog(false)}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showAddEventDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-indigo-600 mb-4 border-b pb-3">
                Tambah Event Baru
              </h3>
              <input
                type="text"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 mb-2 focus:border-indigo-500 focus:outline-none"
                placeholder="Nama Event (Contoh: Kebaktian I : 07:00)"
                autoFocus
              />
              <p className="text-sm text-gray-500 mb-4 bg-indigo-50 p-2 rounded">
                Tanggal: <span className="font-semibold">{selectedDates.find(d => getDayKey(d) === addEventDateKey)?.toLocaleDateString("id-ID") ?? 'N/A'}</span>
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddEventDialog(false);
                    setNewEventName('');
                    setAddEventDateKey(null);
                  }}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleAddEvent}
                  disabled={!newEventName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {openDetailDrawer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
            <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-slide-in">
              <div className="p-6">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                  <h2 className="text-2xl font-bold text-indigo-700">📝 Detail Jemaat</h2>
                  <button
                    onClick={() => setOpenDetailDrawer(false)}
                    className="text-gray-500 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                {formData && (
                  <div className="space-y-5">
                    <div className="flex justify-center mb-6">
                      <div className="relative">
                        <img 
                          src={formData.foto} 
                          alt={formData.nama} 
                          className="rounded-full h-28 w-28 object-cover ring-4 ring-indigo-400 shadow-lg" 
                        />
                        <div className="absolute bottom-0 right-0 bg-green-500 h-6 w-6 rounded-full border-4 border-white"></div>
                      </div>
                    </div>
                    <h3 className="text-center font-bold text-xl text-gray-800 mb-6">{formData.nama}</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          📅 Tanggal Lahir
                        </label>
                        <input
                          type="date"
                          value={formData.tanggalLahir ?? ""}
                          onChange={(e) => setFormData(f => f ? { ...f, tanggalLahir: e.target.value } : null)}
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
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
                          placeholder="Akan terhitung otomatis"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          👨‍👩‍👧‍👦 Keluarga
                        </label>
                        <input
                          type="text"
                          value={formData.keluarga ?? ""}
                          onChange={(e) => setFormData(f => f ? { ...f, keluarga: e.target.value } : null)}
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                          placeholder="Nama keluarga"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          ✉️ Email
                        </label>
                        <input
                          type="email"
                          value={formData.email ?? ""}
                          onChange={(e) => setFormData(f => f ? { ...f, email: e.target.value } : null)}
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                          placeholder="email@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          📱 No. Telp
                        </label>
                        <input
                          type="tel"
                          value={formData.telepon ?? ""}
                          onChange={(e) => setFormData(f => f ? { ...f, telepon: e.target.value } : null)}
                          className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                          placeholder="08xxxxxxxxxx"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            📊 Status Kehadiran
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
                            🏷️ Status
                          </label>
                          <span className={`inline-flex px-3 py-2 text-sm font-semibold rounded-lg w-full justify-center ${
                            formData.status === "Aktif" 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {formData.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          💼 Jabatan
                        </label>
                        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg px-4 py-2.5 text-gray-800 font-medium">
                          {formData.jabatan}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-6 flex justify-end space-x-3 border-t mt-8">
                  <button
                    onClick={() => setOpenDetailDrawer(false)}
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveForm}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                  >
                    💾 Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {openDownloadDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-semibold text-indigo-700 border-b pb-3 mb-4">
                📥 Download Data
              </h3>
              <p className="text-gray-700 mb-6">Pilih format file yang ingin diunduh:</p>
              <div className="flex flex-col gap-3 mb-6">
                <button
                  onClick={() => handleDownload('csv')}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  Download CSV
                </button>
                <button
                  onClick={() => handleDownload('pdf')}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-md flex items-center justify-center gap-2"
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