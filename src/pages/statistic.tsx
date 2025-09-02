"use client";
import { useState } from "react";
import Image from "next/image";
import { UserButton, SignedIn } from "@clerk/nextjs";
import Link from "next/link";
import { Filter, Download, Info } from "lucide-react";

import Drawer from "@mui/material/Drawer";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function Statistic() {

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

      <div className="flex items-center justify-between bg-white px-4 py-3 shadow">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded border px-3 py-1 text-sm">
            <Filter size={14} /> Filter
          </button>
          <button className="flex items-center gap-1 rounded border px-3 py-1 text-sm">
            <Download size={14} /> Download
          </button>
          <Link
            href="/database"
            className="inline-flex items-center gap-1 rounded bg-indigo-500 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-indigo-800"
          >
            Kembali ke Tabel Data
          </Link>
        </div>
      </div>
    </div>
  );
}
