/**
 * REFACTOR: Mengganti logika Event Management menjadi modal terpusat
 * dan menambahkan fitur Event Berkala (Periodical Event) untuk penambahan,
 * pengeditan, dan penghapusan event berulang (hanya di memori).
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Download, X, Settings, ChevronLeft, ChevronRight, BarChart3, Calendar, FileText, Image as LucideImage, UploadCloud, Loader2, Pencil } from "lucide-react"; 
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
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif"; // Status kehadiran terhitung
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string; 
  dokumen?: string; // NEW: Field untuk dokumen/gambar
}

interface PreviewModalData {
    url: string; 
    name: string;
    type: 'image' | 'pdf' | 'other';
}

type ViewMode = 'event_per_table' | 'monthly_summary';
type SelectedEventsByDate = Record<string, string[]>;
type EventsCache = Record<string, string[]>;

// --- Tipe Data Modal Baru ---
type EventModalType = 'add-single' | 'add-periodical' | 'edit-single' | 'edit-periodical-confirm' | 'flow-select';

interface EventModalData {
    type: EventModalType;
    // Data umum
    dateKey: string | null;
    oldName: string | null; // Untuk edit
    newName: string; // Untuk add/edit
    // Data untuk Periodical
    periodicalDayOfWeek: number | null; // 0=Minggu, 1=Senin...
    periodicalPeriod: string; // e.g., '2m', '1y'
}


// --- UTILITY FUNCTIONS & CONSTANTS ---

const PERIOD_OPTIONS = [
  { value: '1m', label: '1 Bulan' },
  { value: '2m', label: '2 Bulan' },
  { value: '6m', label: '6 Bulan' },
  { value: '1y', label: '1 Tahun' },
  { value: '10y', label: 'Selamanya (10 Tahun Simulasi)' }, // Untuk simulasi "selamanya"
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

const isImageUrlOrBase64 = (data: string): boolean => {
    if (!data) return false;
    return data.startsWith('data:image') || 
           /\.(jpeg|jpg|png|gif|webp)$/i.test(data.toLowerCase()) || 
           data.includes('picsum.photos');
};

/**
 * Mengembalikan daftar sesi ibadah yang secara default tersedia pada hari tersebut.
 * FIX: Mengisi fungsi ini dengan sesi yang benar.
 */
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


const getNextDayOfWeek = (date: Date, dayOfWeek: number) => {
    const resultDate = new Date(date.getTime());
    resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
    return resultDate;
}

/**
 * Menghitung daftar tanggal berulang berdasarkan hari dan periode, dimulai dari tanggal yang dipilih.
 * Hanya menghasilkan tanggal di masa depan (lebih besar dari hari ini).
 */
const generateDatesForPeriod = (startDayKey: string, dayOfWeek: number, period: string): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDayKey);
    
    if (isNaN(currentDate.getTime())) return [];
    
    // 1. Tentukan tanggal mulai yang benar (Hari ini atau hari ke-n berikutnya)
    // Mulai dari hari setelah hari ini.
    currentDate = new Date(currentDate.getTime());
    currentDate.setDate(currentDate.getDate() + 1); 
    
    // Maju ke hari yang benar berikutnya dari currentDate
    currentDate = getNextDayOfWeek(currentDate, dayOfWeek);

    // 2. Tentukan tanggal akhir
    const endDate = new Date(currentDate.getTime());
    const [duration, unit] = [parseInt(period.slice(0, -1), 10), period.slice(-1)];

    if (unit === 'm') endDate.setMonth(endDate.getMonth() + duration);
    else if (unit === 'y') endDate.setFullYear(endDate.getFullYear() + duration);
    else if (period === '10y') endDate.setFullYear(endDate.getFullYear() + 10); 

    // Batasi maksimum sampai 10 tahun (untuk alasan kinerja memori di browser)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    if (endDate.getTime() > maxDate.getTime()) {
        endDate.setTime(maxDate.getTime());
    }
    
    const todayStartPlusOneDay = todayStart + (24 * 60 * 60 * 1000); // Batasi hanya untuk masa depan

    // 3. Loop untuk mengumpulkan tanggal
    while (currentDate.getTime() < endDate.getTime() && currentDate.getTime() >= todayStartPlusOneDay) {
        const dayKey = getDayKey(currentDate);
        dates.push(dayKey);
        
        // Pindah ke minggu berikutnya
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return dates;
}

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

// --- Komponen Modal Preview Dokumen (TIDAK BERUBAH) ---
const DocumentPreviewModal = ({ data, onClose }: { data: PreviewModalData | null, onClose: () => void }) => {
    if (!data) return null;

    const isImage = isImageUrlOrBase64(data.url);
    const isPdf = data.type === 'pdf';
    
    let content;

    if (isImage) {
        content = (
            <Image
                src={data.url}
                alt={`Preview ${data.name}`}
                width={800}
                height={600}
                className="max-h-[70vh] w-full object-contain"
                style={{ width: '100%', height: 'auto' }}
                unoptimized
            />
        );
    } else if (isPdf) {
        content = (
            <div className="w-full h-[70vh]">
                <iframe
                    src={data.url}
                    title={`PDF Preview ${data.name}`}
                    className="w-full h-full border-0 rounded-lg"
                    allowFullScreen
                >
                    <div className="p-4 text-center">
                        <p>Browser tidak dapat menampilkan PDF secara langsung.</p>
                        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            Klik di sini untuk mengunduh/melihat PDF di tab baru.
                        </a>
                    </div>
                </iframe>
            </div>
        );
    } else {
        content = (
            <div className="p-6 text-center">
                <FileText size={48} className="text-gray-500 mx-auto mb-3" />
                <p className="text-xl font-semibold mb-2">Format Tidak Dapat Dipreview</p>
                <p className="text-gray-600">File bukan gambar atau PDF yang dapat ditampilkan. Buka tautan di bawah:</p>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all mt-2 inline-block">
                    {data.url}
                </a>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800 truncate">
                        Preview: {data.name}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 flex items-center justify-center">
                    {content}
                </div>
                <div className="p-4 border-t flex justify-end">
                    <a 
                        href={data.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Buka di Tab Baru
                    </a>
                </div>
            </div>
        </div>
    );
};

// --- Komponen Modal Event Management (BARU) ---
const EventManagementModal = ({ data, onUpdateData, onClose, onAction }: { data: Partial<EventModalData>, onUpdateData: (newData: Partial<EventModalData>) => void, onClose: () => void, onAction: () => void }) => {
    const { type, dateKey, oldName, newName, periodicalDayOfWeek, periodicalPeriod } = data;
    
    let title = '';
    let actionButtonText = '';
    let content;

    const isEdit = type === 'edit-single';
    const isAdd = type === 'add-single' || type === 'add-periodical' || type === 'flow-select';
    const isPeriodicalAdd = type === 'add-periodical';
    const isPeriodicalConfirm = type === 'edit-periodical-confirm';

    // Safety check for dateKey
    const dateDisplay = dateKey ? new Date(dateKey).toLocaleDateString("id-ID") : 'N/A';
    const dayOptions = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    if (type === 'flow-select') {
        title = 'Pilih Mode Penambahan Event';
        actionButtonText = 'Lanjut ke Mode Satuan';
        
        content = (
            <div className="space-y-6">
                <p className="text-lg text-gray-700">Event akan ditambahkan untuk tanggal: <span className="font-bold text-indigo-600">{dateDisplay}</span></p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => onUpdateData({ type: 'add-single' })}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-md"
                    >
                        <span className="font-bold">Mode Satuan:</span> Hanya untuk tanggal ini
                    </button>
                    <button 
                        onClick={() => onUpdateData({ type: 'add-periodical' })}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
                    >
                        <span className="font-bold">Mode Berkala:</span> Ulangi di masa depan
                    </button>
                </div>
            </div>
        );
    } else if (isPeriodicalConfirm) {
        title = oldName ? (newName ? `Edit Berkala: ${oldName}` : `Hapus Berkala: ${oldName}`) : 'Konfirmasi Aksi Berkala';
        actionButtonText = newName ? 'Simpan Perubahan Berkala' : 'Hapus Semua Kejadian';
        const actionText = newName ? `mengubah nama event dari "${oldName}" menjadi "${newName}"` : `menghapus event "${oldName}"`;

        content = (
            <div className="space-y-4 p-2">
                <p className={`text-lg font-medium ${newName ? 'text-blue-700' : 'text-red-700'}`}>
                    PERINGATAN! Aksi ini akan berlaku untuk **SEMUA** event bernama **"{oldName}"** pada tanggal **{dateDisplay}** dan **semua tanggal setelahnya**.
                </p>
                <p className="text-gray-700">Anda akan {actionText} mulai dari {dateDisplay} dan ke depannya (hingga 10 tahun simulasi).</p>
                {newName !== undefined ? (
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => onUpdateData({ newName: e.target.value })}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                        placeholder="Nama Event Baru"
                        autoFocus
                    />
                ) : null}
            </div>
        );
    } else if (isEdit) {
        title = `Edit Event: ${oldName}`;
        actionButtonText = 'Simpan Perubahan';
        
        content = (
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Tanggal: <span className="font-semibold">{dateDisplay}</span></p>
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
        title = isPeriodicalAdd ? 'Tambah Event Berkala' : 'Tambah Event Satuan';
        actionButtonText = isPeriodicalAdd ? 'Tambah Event Berkala' : 'Tambah Event Satuan';
        
        content = (
            <div className="space-y-4">
                <div className="flex justify-between">
                    <button 
                        onClick={() => onUpdateData({ type: 'add-single', periodicalDayOfWeek: null, periodicalPeriod: '2m' })}
                        className={`px-4 py-2 text-sm rounded-lg font-semibold transition ${!isPeriodicalAdd ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Mode Satuan
                    </button>
                    <button 
                        onClick={() => onUpdateData({ type: 'add-periodical' })}
                        className={`px-4 py-2 text-sm rounded-lg font-semibold transition ${isPeriodicalAdd ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hari Perulangan</label>
                            <select
                                value={periodicalDayOfWeek ?? 0}
                                onChange={(e) => onUpdateData({ periodicalDayOfWeek: parseInt(e.target.value, 10) })}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                            >
                                {dayOptions.map((day, index) => (
                                    <option key={day} value={index}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Periode Hingga</label>
                            <select
                                value={periodicalPeriod}
                                onChange={(e) => onUpdateData({ periodicalPeriod: e.target.value })}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                            >
                                {PERIOD_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">*Berlaku mulai hari setelah tanggal ini</p>
                        </div>
                    </div>
                )}
            </div>
        );
    } else {
        return null; 
    }
    
    // Logika disesuaikan untuk delete (newName kosong) dan edit (newName ada)
    const isActionDisabled = isPeriodicalConfirm 
        ? (!oldName || (newName !== undefined && !newName.trim() && newName.length > 0))
        : (isAdd && !newName?.trim());

    // Sesuaikan tombol jika ini mode flow-select
    if (type === 'flow-select') {
         return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-xl font-bold text-indigo-600">{title}</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-6">
                        {content}
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-indigo-600">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {content}
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onAction}
                        disabled={isActionDisabled}
                        className={`px-6 py-2 ${isActionDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition`} 
                    >
                        {actionButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- LOGIKA KALENDER (TIDAK BERUBAH) ---
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
    handleDeleteEvent: (dateKey: string, eventName: string) => void;
    handleOpenEditEvent: (dateKey: string, eventName: string) => void;
    handleOpenAddEvent: (dateKey: string) => void; // UPDATED PROP
}

const SelectedEventsSection = ({
    selectedDates, selectedEventsByDate, events, viewMode,
    handleSelectEvent, handleDeleteEvent, handleOpenEditEvent,
    handleOpenAddEvent // UPDATED PROP
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
                        {/* UPDATED: Tombol untuk membuka modal terpusat */}
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

// --- KOMPONEN UTAMA ---
export default function DatabasePage() {
  const router = useRouter();
  useEffect(() => {
    const checkRole = async () => {
      const res = await fetch("/api/me");
      const data = (await res.json()) as { role?: "admin" | "user" }; // ✅ typed
      if (data.role !== "admin") {
        void router.push("/unauthorized"); // ✅ tandai promise supaya no-floating-promises hilang
      }
    };
    void checkRole();
  }, [router]);

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
  
  // NEW: Unified State for Event Management Modal
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
          // Baris 888: Error jika status bukan 200/OK.
          throw new Error(`Gagal fetch data jemaat. Status: ${res.status}`);
        }

        const data: unknown = await res.json();
        
        if (Array.isArray(data) && data.length > 0) {
          const fetchedJemaat = data as Jemaat[];
          setJemaat(fetchedJemaat);
          setDraftJemaat(fetchedJemaat.map(j => ({ ...j })));
          
          // Inisialisasi events cache dengan event unik dari data jemaat yang dimuat
          const allUniqueSessions = new Set<string>();
          fetchedJemaat.forEach(j => {
              if (j.kehadiranSesi) {
                  allUniqueSessions.add(j.kehadiranSesi);
              }
          });
          
          // Logika inisialisasi cache event (hanya hari ini)
          const todayKey = getDayKey(today);
          const initialTodayEvents = [
              "KESELURUHAN DATA HARI INI", 
              ...Array.from(allUniqueSessions)
          ].sort();

          // Hanya set event jika belum ada di cache (mencegah overwrite event berkala)
          if (!memoryStorage.events[todayKey] || memoryStorage.events[todayKey].length === 0) {
              setEvents(prev => ({ 
                  ...prev, 
                  [todayKey]: initialTodayEvents
              }));
              memoryStorage.events[todayKey] = initialTodayEvents;
          }

        } else {
          setJemaat([]);
          setDraftJemaat([]);
        }
      } catch (err) {
        console.error("Error fetch jemaat:", err);
        setJemaat([]); 
        setDraftJemaat([]);
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
  
  // NEW: Handler untuk membuka modal EventManagementModal (langsung add-single)
  const handleOpenAddEvent = useCallback((dateKey: string) => {
      
      setEventModalData({
          type: 'add-single', 
          dateKey,
          newName: '',
          oldName: null,
          periodicalDayOfWeek: new Date(dateKey).getDay(), 
          periodicalPeriod: '2m',
      });
      
      setShowEventModal(true);
  }, []);

  // NEW: Handler untuk menambahkan event satuan (dari modal)
  const handleSingleAddEvent = useCallback(() => {
    const key = eventModalData.dateKey;
    const newName = eventModalData.newName?.trim();

    if (!key || !newName) return;
    
    setViewMode('event_per_table');
    
    const currentEvents = events[key] ?? mockEventsGenerator(key, new Date(key));
    
    // Cek duplikasi untuk single add
    if (currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === newName.toLowerCase())) {
         alert(`Event "${newName}" sudah ada di tanggal ini!`);
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
    setEventModalData({}); // Reset modal data
  }, [eventModalData, events, selectedDates]);

  // NEW: Handler untuk menambahkan event berkala (dari modal)
  const handlePeriodicalAddEvent = useCallback(() => {
    const { periodicalDayOfWeek, periodicalPeriod, newName, dateKey } = eventModalData;
    const eventName = newName?.trim();
    // Pastikan dayOfWeek diambil dari modal data
    const dayOfWeek = periodicalDayOfWeek !== null ? periodicalDayOfWeek : new Date(dateKey ?? '').getDay();

    if (!eventName || dayOfWeek === null || !dateKey || !periodicalPeriod) return;
    
    let initialUpdateCount = 0;
    let periodicalUpdateCount = 0;

    // 1. Tambahkan/Perbarui di tanggal awal yang diklik (dateKey)
    setEvents(prevEvents => {
      const updatedEvents = { ...prevEvents };
      const currentEvents = updatedEvents[dateKey] ?? mockEventsGenerator(dateKey, new Date(dateKey));

      // Cek duplikasi untuk tanggal awal
      if (currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === eventName.toLowerCase())) {
          updatedEvents[dateKey] = [
              "KESELURUHAN DATA HARI INI", 
              ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI" && e !== eventName), 
              eventName
          ].filter((v, i, a) => a.indexOf(v) === i);
          initialUpdateCount++;
      } else {
          // Hanya tambahkan jika benar-benar baru
          updatedEvents[dateKey] = [
              "KESELURUHAN DATA HARI INI", 
              ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI"), 
              eventName
          ].filter((v, i, a) => a.indexOf(v) === i);
          initialUpdateCount++;
      }
      memoryStorage.events = updatedEvents;
      return updatedEvents;
    });
    
    // 2. Hitung tanggal masa depan yang berulang
    const datesToUpdate = generateDatesForPeriod(dateKey, dayOfWeek, periodicalPeriod);
    
    // 3. Terapkan event ke semua tanggal berulang
    setEvents(prevEvents => {
        const updatedEvents = { ...prevEvents };
        
        datesToUpdate.forEach(key => {
            const date = new Date(key);
            
            const initialEvents = mockEventsGenerator(key, date);
            const currentEvents = updatedEvents[key] ?? initialEvents;

            // Jika event sudah ada, lewati.
            if (currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI").some(e => e.toLowerCase() === eventName.toLowerCase())) {
                return;
            }
            
            // Tambahkan event baru ke daftar event yang sudah ada
            const newEventsList = [
                "KESELURUHAN DATA HARI INI", 
                ...currentEvents.filter(e => e !== "KESELURUHAN DATA HARI INI"), 
                eventName
            ].filter((v, i, a) => a.indexOf(v) === i); 

            updatedEvents[key] = newEventsList;
            periodicalUpdateCount++;
        });

        memoryStorage.events = updatedEvents;
        return updatedEvents;
    });

    if (initialUpdateCount > 0 || periodicalUpdateCount > 0) {
        alert(`${initialUpdateCount + periodicalUpdateCount} Event "${eventName}" telah ditambahkan. ${periodicalUpdateCount} di antaranya ditambahkan secara berkala dari ${new Date(dateKey).toLocaleDateString("id-ID")} hingga ${PERIOD_OPTIONS.find(p => p.value === periodicalPeriod)?.label ?? 'periode yang dipilih'}.`);
        
        // Cek dan tambahkan tanggal mulai (dateKey) jika belum dipilih
        if (!selectedDates.some(d => getDayKey(d) === dateKey)) {
             setSelectedDates(prev => [...prev, new Date(dateKey)].sort((a, b) => a.getTime() - b.getTime()));
        }
        
        // Pilih event yang baru ditambahkan di tanggal awal (dateKey)
        setSelectedEventsByDate(prev => {
            const currentSelected = prev[dateKey] ?? [];
            const newSelected = [...currentSelected, eventName];
            const newEventsByDate = { ...prev, [dateKey]: newSelected.filter(e => e) };
            saveSelection(selectedDates, newEventsByDate);
            return newEventsByDate;
        });

    } else {
         alert(`Gagal menambahkan event, atau event "${eventName}" sudah ada di semua periode yang dipilih.`);
    }

    setShowEventModal(false);
    setEventModalData({}); // Reset modal data
  }, [eventModalData, events, selectedDates]);


  // NEW: Handler untuk aksi dari modal (gabungan dari single add/periodical add/edit/delete confirm)
  const handleEventAction = useCallback(() => {
    switch(eventModalData.type) {
        case 'add-single':
            handleSingleAddEvent();
            break;
        case 'add-periodical':
            handlePeriodicalAddEvent();
            break;
        case 'edit-single':
            // Lakukan edit untuk single
            const { dateKey: key, oldName, newName: newN } = eventModalData;
            const newNameTrim = newN?.trim();
            if (!key || !oldName || !newNameTrim || oldName === newNameTrim) {
                setShowEventModal(false);
                return;
            }
            
            setEvents(prevEvents => {
                const currentEvents = prevEvents[key] ?? [];
                const oldIndex = currentEvents.indexOf(oldName);
                
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
            break;
        case 'edit-periodical-confirm':
            // Lakukan edit/delete untuk semua event yang namanya sama di masa depan
            const { dateKey: startKey, oldName: nameToChange, newName: newNPeriodic } = eventModalData;
            const isDeletion = !newNPeriodic || newNPeriodic.trim() === ''; // If newName is empty/null, it's a deletion
            const newNamePeriodic = newNPeriodic?.trim() ?? '';
            
            if (!startKey || !nameToChange || (!isDeletion && !newNamePeriodic)) return;

            setEvents(prevEvents => {
                const updatedEvents = { ...prevEvents };
                const startDate = new Date(startKey).setHours(0, 0, 0, 0);
                
                Object.keys(updatedEvents).forEach(key => {
                    const currentDate = new Date(key).setHours(0, 0, 0, 0);
                    // Filter: Hanya tanggal yang sama atau lebih baru dari startKey
                    if (currentDate >= startDate) {
                        let eventsList = updatedEvents[key] ?? [];
                        
                        if (eventsList.includes(nameToChange)) {
                            if (isDeletion) {
                                // Hapus event
                                eventsList = eventsList.filter(e => e !== nameToChange);
                            } else {
                                // Edit event
                                eventsList = eventsList.map(e => (e === nameToChange ? newNamePeriodic : e));
                            }
                            updatedEvents[key] = eventsList.filter((v, i, a) => a.indexOf(v) === i); 
                        }
                    }
                });

                memoryStorage.events = updatedEvents;
                return updatedEvents;
            });
            
            // Update selected state (deselected jika dihapus, ganti nama jika diubah)
             setSelectedEventsByDate(prevSelected => {
                const updatedSelected = { ...prevSelected };
                Object.keys(updatedSelected).forEach(key => {
                    const currentDate = new Date(key).setHours(0, 0, 0, 0);
                    const startDate = new Date(startKey).setHours(0, 0, 0, 0);

                    // Hanya yang sama atau lebih baru dari startKey
                    if (currentDate >= startDate) {
                         let selectedList = updatedSelected[key] ?? [];
                         if (selectedList.includes(nameToChange)) {
                            if (isDeletion) {
                                selectedList = selectedList.filter(e => e !== nameToChange);
                            } else {
                                selectedList = selectedList.map(e => (e === nameToChange ? newNamePeriodic : e));
                            }
                            updatedSelected[key] = selectedList.filter((v, i, a) => a.indexOf(v) === i);
                         }
                    }
                });
                
                saveSelection(selectedDates, updatedSelected);
                return updatedSelected;
            });

            alert(`Event "${nameToChange}" telah ${isDeletion ? 'dihapus' : 'diperbarui'} dari ${new Date(startKey).toLocaleDateString("id-ID")} dan semua tanggal setelahnya.`);
            setShowEventModal(false);
            setEventModalData({});
            break;
        case 'flow-select':
            // Ini seharusnya tidak dipanggil karena di-handle di modal, tapi untuk safety, kita default ke single
            onAction(); 
            break;
        default:
            break;
    }
  }, [eventModalData, handleSingleAddEvent, handlePeriodicalAddEvent, events, selectedDates]);

  // Refactor `handleDeleteEvent`
  const handleDeleteEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return; 
      
      const isMockEvent = mockEventsGenerator(dateKey, new Date(dateKey)).includes(eventName);

      if (isMockEvent || !confirm(`Event "${eventName}" mungkin berulang. Apakah Anda ingin menghapus HANYA untuk tanggal ini? (Pilih 'Batal' untuk menghapus semua event masa depan yang namanya sama).`)) {
          // Jika Batal (untuk non-mock) atau default mock event, buka modal konfirmasi untuk delete periodical
          setEventModalData({
              type: 'edit-periodical-confirm',
              dateKey,
              oldName: eventName,
              newName: '', // Kosong = delete
              periodicalDayOfWeek: null,
              periodicalPeriod: '',
          });
          setShowEventModal(true);
          return;
      }
      
      // Lakukan penghapusan single instance
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
  }, [selectedDates]);


  // Refactor `handleOpenEditEvent`
  const handleOpenEditEvent = useCallback((dateKey: string, eventName: string) => {
      if (eventName === "KESELURUHAN DATA HARI INI") return;
      
      const isMockEvent = mockEventsGenerator(dateKey, new Date(dateKey)).includes(eventName);
      
      if (isMockEvent || confirm(`Event "${eventName}" mungkin berulang. Apakah Anda ingin mengedit nama event ini untuk SEMUA tanggal yang akan datang, dimulai dari ${new Date(dateKey).toLocaleDateString("id-ID")}${(isMockEvent ? ' (Ini adalah event default)' : '')}?`)) {
          // Jika Ya (untuk non-mock) atau default mock event, set modal untuk konfirmasi edit periodical
          setEventModalData({
              type: 'edit-periodical-confirm',
              dateKey,
              oldName: eventName,
              newName: eventName, 
              periodicalDayOfWeek: null,
              periodicalPeriod: '',
          });
          setShowEventModal(true);
          return;
      }

      // Default ke edit single
      setEventModalData({ 
        type: 'edit-single', 
        dateKey, 
        oldName: eventName, 
        newName: eventName,
        periodicalDayOfWeek: null,
        periodicalPeriod: '2m',
      });
      setShowEventModal(true);
  }, []);

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
  
  /**
   * FIX LOGIC: Menggunakan getAvailableSessionNames(dateObj) untuk filter KESELURUHAN DATA HARI INI.
   * Ini memastikan hanya Jemaat yang sesi kehadirannya (kehadiranSesi) sesuai dengan hari yang dipilih (Sabtu/Minggu) yang ditampilkan.
   */
  const getFilteredJemaatPerEvent = useCallback((jemaatList: Jemaat[], dateKey: string, event: string): Jemaat[] => {
    
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
    
    // KESELURUHAN DATA HARI INI (Simulasi Kehadiran untuk tanggal yang dipilih)
    if (event === "KESELURUHAN DATA HARI INI") {
        
        const dateObj = new Date(dateKey);
        // FIX: Dapatkan sesi yang tersedia di tanggal ini
        const availableSessions = getAvailableSessionNames(dateObj); 
        
        // Jemaat yang berpotensi hadir (kehadiranSesi-nya ada di daftar sesi yang tersedia hari ini)
        const jemaatPotentialyPresent = filteredData.filter(j => 
            availableSessions.includes(j.kehadiranSesi)
        );

        if (filterKehadiranSesi !== "") {
            return jemaatPotentialyPresent.filter(j => j.kehadiranSesi === filterKehadiranSesi);
        }
        
        return jemaatPotentialyPresent; 
    }
    
    // Logika untuk event spesifik (KehadiranSesi harus sama dengan nama event)
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
    
  // Mengambil semua sesi unik dari Jemaat data yang dimuat
  const uniqueKehadiranSesiByDate = useMemo(() => {
    
    const allUniqueSessions = Array.from(new Set(jemaat.map((j) => j.kehadiranSesi)));

    if (selectedTables.length === 0 || viewMode === 'monthly_summary') {
        // Mode default atau Monthly Summary: tampilkan semua sesi unik yang ada
        return allUniqueSessions;
    }
    
    // Jika mode Event Per Table dan event yang dipilih adalah 'KESELURUHAN DATA HARI INI'
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        // Tampilkan semua sesi unik yang ada
        return allUniqueSessions.sort();
    } 
    
    // Jika event spesifik dipilih, tampilkan hanya event yang dipilih
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
          alert(`Dokumen "${selectedFile.name}" berhasil diunggah dan disimpan (Simulasi)!`);
      } catch (error) {
          console.error("Error mock uploading file:", error);
          alert("Gagal mengunggah dokumen (Mock Error).");
      } finally {
          setIsUploading(false);
          setSelectedFile(null); 
      }
  }, [selectedFile, formData]);
  
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
    
    // Sesi filter hanya ditampilkan jika mode event_per_table DAN event yang dipilih adalah 'KESELURUHAN DATA HARI INI'
    if (selectedTables.length === 1 && selectedTables[0]?.event === 'KESELURUHAN DATA HARI INI') {
        return true;
    }
    
    // Jika event spesifik dipilih, filter sesi tidak perlu ditampilkan
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
            handleDeleteEvent={handleDeleteEvent}
            handleOpenEditEvent={handleOpenEditEvent}
            handleOpenAddEvent={handleOpenAddEvent} // UPDATED PROP
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
              
              <div className="flex-grow flex justify-end gap-2">
                {!editMode ? (
                  <button 
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition" 
                  >
                    <Settings size={18} />
                    <span className="hidden sm:inline">Edit Data</span>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition" 
                    >
                      Simpan
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
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
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Dokumen</th> 
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pagedData.map((j, i) => {
                            const draftItem = draftJemaat.find(d => d.id === j.id) ?? j;
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
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {draftItem.kehadiranSesi}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
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
                                <td className="px-4 py-3 whitespace-nowrap text-center">
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
        
        {/* NEW: Event Management Modal */}
        {showEventModal && (
            <EventManagementModal 
                data={eventModalData}
                onUpdateData={updateEventModalData}
                onClose={() => setShowEventModal(false)}
                onAction={handleEventAction}
            />
        )}


        {openDetailDrawer && formData && (
          <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
            <div className="bg-white w-full max-w-md h-full overflow-y-auto animate-slide-in"> 
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
                        Unggah Dokumen/Gambar
                      </label>
                      <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg bg-gray-50">
                          <input
                              id={`file-upload-${formData.id}`}
                              type="file"
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".jpg,.jpeg,.png,.pdf" 
                          />
                          <label htmlFor={`file-upload-${formData.id}`} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition cursor-pointer"> 
                              <UploadCloud size={18} />
                              {selectedFile ? selectedFile.name : "Pilih File"}
                          </label>
                          
                          {selectedFile && (
                              <div className="mt-3 flex justify-between items-center text-sm">
                                  <span className="truncate text-gray-700">{selectedFile.name}</span>
                                  <button
                                      onClick={handleFileUpload}
                                      disabled={isUploading}
                                      className={`ml-3 px-3 py-1 text-xs font-medium rounded-lg transition flex items-center gap-1 ${
                                          isUploading 
                                          ? 'bg-gray-400 text-white cursor-not-allowed'
                                          : 'bg-green-500 text-white hover:bg-green-600'
                                      }`}
                                  >
                                      {isUploading ? <><Loader2 size={14} className="animate-spin" /> Mengunggah...</> : 'Upload'}
                                  </button>
                              </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">Format: JPG, PNG, PDF (Maks. 5MB Simulasi)</p>
                          
                          {formData.dokumen && (
                              <button
                                  onClick={() => {
                                    if (confirm("Yakin ingin menghapus dokumen ini?")) {
                                      setFormData(f => f ? { ...f, dokumen: undefined } : null)
                                    }
                                  }}
                                  className="mt-3 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                              >
                                  <X size={12} /> Hapus Dokumen Saat Ini
                              </button>
                          )}
                      </div>
                      
                      {(formData.dokumen ?? getPreviewUrl) && (
                        <div className="mt-4 p-3 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                          <p className="text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                            Preview {(selectedFile && "File Baru") ?? "Tersimpan"}
                          </p>
                          {isImageUrlOrBase64(getPreviewUrl ?? '') ? (
                            <Image
                              src={getPreviewUrl ?? ""}
                              alt="Dokumen Preview"
                              width={64}
                              height={64}
                              className="w-16 h-16 object-cover rounded-md border border-gray-300 bg-white inline-block"
                            />
                          ) : (getPreviewUrl?.includes('.pdf') || selectedFile?.type?.includes('pdf')) ? (
                            <div className="flex items-center gap-2 text-gray-700">
                              <FileText size={24} />
                              <p className="text-sm">File PDF siap (Preview di Modal)</p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Format tidak didukung untuk preview langsung.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tanggal Lahir
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
                        Keluarga
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
                        Email
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
                        No. Telp
                      </label>
                      <input
                        type="tel"
                        value={formData.telepon ?? ""}
                        onChange={(e) => setFormData(f => f ? { ...f, telepon: e.target.value } : null)}
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:border-indigo-500 focus:outline-none"
                        placeholder="08xxxxxxxxxx"
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
                      <div className="bg-indigo-500 border-2 border-indigo-200 rounded-lg px-4 py-2.5 text-gray-800 font-medium">
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
                    Batal
                  </button>
                  <button
                    onClick={handleSaveForm}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" 
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DocumentPreviewModal data={previewModalData} onClose={closePreviewModal} />
        
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