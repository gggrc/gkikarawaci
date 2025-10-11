"use client";
import React from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { UserButton, SignedIn } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";


// Extend Window type for __addEventDateKey
declare global {
  interface Window {
    __addEventDateKey?: string;
  }
}

import Drawer from "@mui/material/Drawer";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const monthNames: string[] = [
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

export default function DatabasePage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  // For each selected date, store selected events: { 'YYYY-MM-DD': [event1, event2] }
  const [selectedEventsByDate, setSelectedEventsByDate] = useState<Record<string, string[]>>({});
  // Local event state: Record<string, string[]>
  const [events, setEvents] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('events');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, string[]>;
          }
        } catch {
          // ignore parse error
        }
      }
      return {};
    }
    return {};
  });
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  // For event deletion UI: which date and event is being deleted
  const [deleteTarget, setDeleteTarget] = useState<{dateKey: string, event: string} | null>(null);
  const [addEventDateKey, setAddEventDateKey] = useState<string | null>(null);

  const today = new Date();

  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number): number => {
    return new Date(year, month, 1).getDay();
  };

  // Multi-select date logic
  const handleSelectDate = (day: number, month: number) => {
    setSelectedMonth(null);
    const clickedDate = new Date(year, month, day);
    const key = clickedDate.toISOString().slice(0,10);
    setSelectedDates(prev => {
      const exists = prev.some(d => d.toISOString().slice(0,10) === key);
      if (exists) {
        // Remove date if already selected
        return prev.filter(d => d.toISOString().slice(0,10) !== key);
      } else {
        // Add date
        // Check if this date is Saturday or Sunday
        const dayOfWeek = clickedDate.getDay(); // 0 = Sunday, 6 = Saturday
        let defaultEvents: string[] = [];
        if (dayOfWeek === 5) {
          // Saturday
          defaultEvents = [
            "Ibadah Dewasa : Sabtu, 17:00",
            "Ibadah Lansia : Sabtu, 10:00"
          ];
        } else if (dayOfWeek === 6) {
          // Sunday
          defaultEvents = [
            "Kebaktian I : 07:00",
            "Kebaktian II : 10:00",
            "Kebaktian III : 17:00",
            "Ibadah Anak : Minggu, 10:00",
            "Ibadah Remaja : Minggu, 10:00",
            "Ibadah Pemuda : Minggu, 10:00"
          ];
        }
        // Only add defaults if not already present
        setEvents(prevEvents => {
          const existing = prevEvents[key] ?? [];
          const merged = [...existing];
          defaultEvents.forEach(ev => {
            if (!existing.includes(ev)) merged.push(ev);
          });
          if (merged.length > 0) {
            const updated = { ...prevEvents, [key]: merged };
            localStorage.setItem('events', JSON.stringify(updated));
            return updated;
          }
          return prevEvents;
        });
        return [...prev, clickedDate];
      }
    });
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
  };

  // Delete event logic for multi-date selection
  const handleDeleteEvent = () => {
    if (!deleteTarget) return;
    const { dateKey, event } = deleteTarget;
    const filtered = (events[dateKey] ?? []).filter((ev: string) => ev !== event);
    const updated = { ...events, [dateKey]: filtered };
    setEvents(updated);
    localStorage.setItem('events', JSON.stringify(updated));
    setDeleteTarget(null);
    setSelectedEventsByDate(prev => {
      const current = prev[dateKey] ?? [];
      return { ...prev, [dateKey]: current.filter((e: string) => e !== event) };
    });
  };

  const router = useRouter();

  const handleNext = () => {
    if (!selectedDates.length && selectedMonth === null) {
      return alert("Pilih tanggal dulu!");
    }
    // Validate at least one event selected for each date
    for (const date of selectedDates) {
      const key = date.toISOString().slice(0,10);
      if (!selectedEventsByDate[key]?.length) {
        return alert(`Pilih event untuk ${date.toLocaleDateString("id-ID")}`);
      }
    }
    localStorage.setItem(
      "ibadahSelection",
      JSON.stringify({
        year,
        selectedMonth,
        selectedDates: selectedDates.map(d => d.toISOString().slice(0,10)),
        selectedEventsByDate,
      }),
    );
    void router.push("/database");
  };

  const [open, setOpen] = useState(false);

  // Add Event Modal logic (fix possible undefined)
  const handleAddEvent = () => {
    if (!selectedDates.length) return alert('Pilih tanggal dulu!');
    const lastDate = selectedDates[selectedDates.length-1];
    if (!lastDate) return;
    const key = lastDate.toISOString().slice(0,10);
    const updated = { ...events, [key]: [...(events[key]??[]), newEventName.trim()] };
    setEvents(updated);
    localStorage.setItem('events', JSON.stringify(updated));
    setShowEventModal(false);
    setNewEventName('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="rounded-lg bg-white p-6 shadow-lg w-80">
            <h2 className="mb-4 text-lg font-bold">Add Event</h2>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 mb-4"
              placeholder="Event name"
              value={newEventName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded bg-gray-300"
                onClick={() => { setShowEventModal(false); setNewEventName(''); }}
              >Cancel</button>
              <button
                className="px-4 py-2 rounded bg-indigo-600 text-white"
                onClick={handleAddEvent}
              >Add</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between bg-indigo-900 px-4 py-2 text-white">
        <div className="flex items-center space-x-2">
          <Image
            src="/LOGOGKI.png"
            alt="Logo"
            width={48}
            height={48}
            className="h-12 w-12"
          />
          <span className="ml-3 text-2xl font-bold">
            Data Jemaat GKI Karawaci
          </span>
        </div>
        <div className="flex space-x-2">
          <div className="group relative inline-block">
            {/* Tombol Info */}
            <button
              onClick={() => setOpen(true)}
              className="rounded-full p-2 transition-colors duration-300 hover:bg-indigo-600"
            >
              <Info size={25} />
            </button>

            <div className="absolute left-1/2 mt-2 -translate-x-1/2 scale-75 rounded-lg bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              Info
            </div>

            <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
              <div style={{ width: 320, padding: "16px" }}>
                <Typography variant="h6" gutterBottom>
                  Help
                </Typography>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>How to use?</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      - Open the app <br />
                      - Navigate through the menu <br />- Select the feature you
                      want to use
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>How to change password?</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      - Go to settings <br />
                      - Select account <br />
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>How to contact support?</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2">
                      - Email: support@example.com <br />- Phone: +62
                      812-3456-7890
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </div>
            </Drawer>
          </div>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>

      <div className="bg-indigo-400 py-2 text-center font-semibold text-white">
        Pilih Bulan atau Tanggal Ibadah
      </div>

      {/* Tahun */}
      <div className="mt-4 flex items-center justify-center space-x-4">
        <button
          onClick={() => setYear(year - 1)}
          className="rounded-full p-2 hover:bg-indigo-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">Tahun {year}</h2>
        <button
          onClick={() =>
            year < today.getFullYear()
              ? setYear(year + 1)
              : alert("Tidak bisa memilih tahun di masa depan")
          }
          className={`rounded-full p-2 ${
            year >= today.getFullYear()
              ? "cursor-not-allowed text-gray-400"
              : "hover:bg-indigo-200"
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Kalender Bulan */}
      <div className="grid flex-grow grid-cols-1 gap-6 p-6 md:grid-cols-3">
        {monthNames.map((month, monthIndex) => {
          const daysInMonth = getDaysInMonth(monthIndex, year);
          const firstDay = getFirstDayOfMonth(monthIndex, year);

          const daysArray: (number | null)[] = [
            ...Array<number | null>(firstDay).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];

          const monthIsFuture =
            year > today.getFullYear() ||
            (year === today.getFullYear() && monthIndex > today.getMonth());

          return (
            <div
              key={month}
              className={`transform rounded-2xl bg-white p-4 shadow transition duration-300 ${
                selectedMonth === monthIndex ? "border-2 border-indigo-600" : ""
              }`}
            >
              <h3
                className={`mb-2 text-center font-semibold ${
                  monthIsFuture
                    ? "cursor-not-allowed text-gray-400"
                    : "cursor-pointer hover:text-indigo-600"
                } ${selectedMonth === monthIndex ? "text-indigo-600" : ""}`}
                onClick={() => !monthIsFuture && handleSelectMonth(monthIndex)}
              >
                {month}
              </h3>

              <div className="mb-2 grid grid-cols-7 text-xs text-gray-500">
                {["m", "t", "w", "t", "f", "s", "s"].map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {daysArray.map((day, i) => {
                  if (day === null) return <div key={i}></div>;
                  const thisDate = new Date(year, monthIndex, day);
                  const isFuture = thisDate > today;
                  const key = thisDate.toISOString().slice(0,10);
                  const isSelected = selectedDates.some(d => d.toISOString().slice(0,10) === key);
                  return (
                    <div
                      key={i}
                      className={`rounded-lg p-1 ${
                        isFuture
                          ? "cursor-not-allowed text-gray-400"
                          : "cursor-pointer hover:bg-indigo-200"
                      } ${isSelected ? "bg-indigo-600 text-white" : ""}`}
                      onClick={() =>
                        !isFuture && handleSelectDate(day, monthIndex)
                      }
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info tanggal/bulan terpilih & Event List (single block, cleaned) */}
      {selectedDates.length > 0 && (
        <div className="mb-6 flex flex-col gap-2 px-6">
          <div className="flex items-center justify-between">
            <p className="ml-130 font-bold">
              {selectedDates.length > 0
                ? `Tanggal terpilih: ${selectedDates.map((d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })).join(", ")}`
                : selectedMonth !== null
                  ? `Bulan terpilih: ${monthNames[selectedMonth]} ${year}`
                  : ""}
            </p>
          </div>
          {/* Event List for each selected date, with event selection */}
          {selectedDates.map((date: Date) => {
            const key = date.toISOString().slice(0,10);
            return (
              <div key={key} className="flex flex-col gap-2 mt-2 border-b pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Events for {date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}:</span>
                  <button
                    className="rounded bg-green-600 px-3 py-1 text-white text-sm font-semibold shadow hover:bg-green-700"
                    onClick={() => {
                      setShowEventModal(true);
                      setNewEventName("");
                      setAddEventDateKey(key);
                    }}
                  >+ Add Events</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(events[key] ?? []).map((ev: string, idx: number) => (
                    <div key={ev+idx} className="flex items-center gap-1">
                      <button
                        className={`px-3 py-1 rounded ${selectedEventsByDate[key]?.includes(ev) ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                        onClick={() => {
                          setSelectedEventsByDate(prev => {
                            const current = prev[key] ?? [];
                            if (current.includes(ev)) {
                              // Remove event
                              return { ...prev, [key]: current.filter((e: string) => e !== ev) };
                            } else {
                              // Add event
                              return { ...prev, [key]: [...current, ev] };
                            }
                          });
                        }}
                      >{ev}</button>
                      <button
                        className="px-2 py-1 rounded bg-red-500 text-white text-xs"
                        title="Delete Event"
                        onClick={() => setDeleteTarget({ dateKey: key, event: ev })}
                      >🗑</button>
                    </div>
                  ))}
                  {!(events[key] ?? []).length && (
                    <span className="text-gray-500">No events yet.</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end mt-2">
            <button
              onClick={handleNext}
              className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white shadow-lg hover:bg-indigo-700"
            >
              Next →
            </button>
          </div>
          {/* Delete Event Modal */}
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="rounded-lg bg-white p-6 shadow-lg w-80">
                <h2 className="mb-4 text-lg font-bold">Delete Event</h2>
                <p>Are you sure you want to delete <b>{deleteTarget.event}</b> from <b>{selectedDates.find(d => d.toISOString().slice(0,10) === deleteTarget.dateKey)?.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</b>?</p>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    className="px-4 py-2 rounded bg-gray-300"
                    onClick={() => setDeleteTarget(null)}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-red-600 text-white"
                    onClick={handleDeleteEvent}
                  >Delete</button>
                </div>
              </div>
            </div>
          )}
          {/* Add Event Modal (per date) */}
          {showEventModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="rounded-lg bg-white p-6 shadow-lg w-80">
                <h2 className="mb-4 text-lg font-bold">Add Event</h2>
                <input
                  type="text"
                  className="w-full rounded border px-3 py-2 mb-4"
                  placeholder="Event name"
                  value={newEventName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    className="px-4 py-2 rounded bg-gray-300"
                    onClick={() => { setShowEventModal(false); setNewEventName(''); }}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-indigo-600 text-white"
                    onClick={() => {
                      const key = addEventDateKey ?? (selectedDates[selectedDates.length-1]?.toISOString().slice(0,10));
                      if (!key || typeof key !== 'string' || !newEventName.trim()) return;
                      const updated = { ...events, [key]: [...(events[key]??[]), newEventName.trim()] };
                      setEvents(updated);
                      localStorage.setItem('events', JSON.stringify(updated));
                      setShowEventModal(false);
                      setNewEventName('');
                      setAddEventDateKey(null);
                    }}
                  >Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {selectedDates.length > 0 && (
        <div className="mb-6 flex flex-col gap-2 px-6">
          
          {/* Delete Event Modal */}
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="rounded-lg bg-white p-6 shadow-lg w-80">
                <h2 className="mb-4 text-lg font-bold">Delete Event</h2>
                <p>Are you sure you want to delete <b>{deleteTarget.event}</b> from <b>{selectedDates.find(d => d.toISOString().slice(0,10) === deleteTarget.dateKey)?.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</b>?</p>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    className="px-4 py-2 rounded bg-gray-300"
                    onClick={() => setDeleteTarget(null)}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-red-600 text-white"
                    onClick={handleDeleteEvent}
                  >Delete</button>
                </div>
              </div>
            </div>
          )}
          {/* Add Event Modal (per date) */}
          {showEventModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="rounded-lg bg-white p-6 shadow-lg w-80">
                <h2 className="mb-4 text-lg font-bold">Add Event</h2>
                <input
                  type="text"
                  className="w-full rounded border px-3 py-2 mb-4"
                  placeholder="Event name"
                  value={newEventName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEventName(e.target.value)}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    className="px-4 py-2 rounded bg-gray-300"
                    onClick={() => { setShowEventModal(false); setNewEventName(''); }}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-indigo-600 text-white"
                    onClick={() => {
                      const key = addEventDateKey ?? (selectedDates[selectedDates.length-1]?.toISOString().slice(0,10));
                      if (!key || typeof key !== 'string' || !newEventName.trim()) return;
                      const updated = { ...events, [key]: [...(events[key]??[]), newEventName.trim()] };
                      setEvents(updated);
                      localStorage.setItem('events', JSON.stringify(updated));
                      setShowEventModal(false);
                      setNewEventName('');
                      setAddEventDateKey(null);
                    }}
                  >Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
