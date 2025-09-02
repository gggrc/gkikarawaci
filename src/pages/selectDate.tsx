"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { UserButton, SignedIn } from "@clerk/nextjs";

import Drawer from "@mui/material/Drawer";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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

export default function DatabasePage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleSelectDate = (day: number, month: number) => {
    setSelectedMonth(null);
    setSelectedDate(new Date(year, month, day));
  };

  const handleSelectMonth = (month: number) => {
    setSelectedDate(null);
    setSelectedMonth(month);
  };

  const router = useRouter();

  const handleNext = () => {
    if (selectedDate === null && selectedMonth === null) {
      return alert("Pilih bulan atau tanggal dulu!");
    }

    localStorage.setItem(
      "ibadahSelection",
      JSON.stringify({
        year,
        selectedMonth,
        selectedDate,
      }),
    );
    void router.push("/database");
  };

  const [open, setOpen] = useState(false);


  return (
    <div className="flex min-h-screen flex-col bg-gray-200">
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
                      - Navigate through the menu <br />
                      - Select the feature you want to use
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
                      - Email: support@example.com <br />
                      - Phone: +62 812-3456-7890
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

      <div className="mt-4 flex items-center justify-center space-x-4">
        <button
          onClick={() => setYear(year - 1)}
          className="rounded-full p-2 hover:bg-indigo-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">Tahun {year}</h2>
        <button
          onClick={() => setYear(year + 1)}
          className="rounded-full p-2 hover:bg-indigo-200"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid flex-grow grid-cols-1 gap-6 p-6 md:grid-cols-3">
        {monthNames.map((month, monthIndex) => {
          const daysInMonth = getDaysInMonth(monthIndex, year);
          const firstDay = getFirstDayOfMonth(monthIndex, year);

          const daysArray = Array(firstDay)
            .fill(null)
            .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

          return (
            <div
              key={month}
              className={`transform rounded-2xl bg-white p-4 shadow transition duration-300 hover:scale-105 hover:shadow-xl ${
                selectedMonth === monthIndex ? "border-2 border-indigo-600" : ""
              }`}
            >
              <h3
                className={`mb-2 cursor-pointer text-center font-semibold ${
                  selectedMonth === monthIndex ? "text-indigo-600" : ""
                }`}
                onClick={() => handleSelectMonth(monthIndex)}
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
                {daysArray.map((day, i) => (
                  <div
                    key={i}
                    className={`cursor-pointer rounded-lg p-1 ${
                      day === null
                        ? ""
                        : selectedDate &&
                            selectedDate.getDate() === day &&
                            selectedDate.getMonth() === monthIndex &&
                            selectedDate.getFullYear() === year
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-indigo-200"
                    }`}
                    onClick={() =>
                      typeof day === "number" &&
                      handleSelectDate(day, monthIndex)
                    }
                  >
                    {day ?? ""}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(selectedDate ?? selectedMonth !== null) && (
        <div className="mb-6 flex items-center justify-between px-6">
          <p className="ml-130 font-bold">
            {selectedDate
              ? `Tanggal terpilih: ${selectedDate.toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}`
              : selectedMonth !== null
                ? `Bulan terpilih: ${monthNames[selectedMonth]} ${year}`
                : ""}
          </p>
          <button
            onClick={handleNext}
            className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white shadow-lg hover:bg-indigo-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
