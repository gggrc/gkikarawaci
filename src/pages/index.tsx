import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { SignedOut, SignedIn, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

// Lazy Render Layout
const MainLayout = dynamic(() => import("@/components/MainLayout"), {
  ssr: true,
  loading: () => <div className="min-h-screen bg-[#0f172a]" />,
});

export default function Home() {
  const [activeSection, setActiveSection] = useState<string>("home");
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    const sections = document.querySelectorAll("section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.6 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => sections.forEach((section) => observer.unobserve(section));
  }, []);

  const handleDaftarHadir = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch("/api/me");
      const data = await res.json();
      if (data.isVerified === "pending" || data.isVerified === "rejected") {
        router.push("/waiting");
      } else {
        router.push("/statistic");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <MainLayout activeSection={activeSection}>
      <section
        id="home"
        className="relative flex min-h-screen flex-col items-center justify-start"
      >
        <div className="absolute inset-0 bg-[url('/backgroundHome.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/85" />

        <div className="relative z-10 flex flex-1 flex-col items-start justify-start px-6 pt-40 text-left md:pr-80">
          <h1 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
            Welcome
          </h1>
          <p className="mt-6 max-w-xl text-base text-gray-100 sm:max-w-2xl sm:text-lg">
            Temukan informasi lengkap tentang kehadiran dan keterlibatan jemaat
            dalam ibadah dan pelayanan. Mari kita bersama meninjau pertumbuhan
            komunitas kita, sebagai bagian dari panggilan untuk terus bertumbuh
            dalam iman dan kesetiaan.
          </p>
          <SignedOut>
            <Link href="/login">
              <button className="mt-10 rounded-lg bg-blue-500 px-5 py-2.5 font-medium text-white shadow-lg transition hover:bg-blue-600 sm:px-6 sm:py-3">
                Bergabung dengan kami sekarang →
              </button>
            </Link>
          </SignedOut>
        </div>
      </section>

      <section
        id="about"
        className="relative flex min-h-screen flex-col items-center justify-start bg-gray-200 pt-32 pb-10 sm:pt-48"
      >
        <div className="container mx-auto flex flex-col items-center gap-8 px-6 py-6 md:flex-row md:gap-12 md:py-33">
          <div className="flex-1 p-4 text-center md:p-0 md:text-left">
            <h2 className="mb-4 text-3xl font-bold text-gray-800 sm:text-4xl md:text-4xl">
              Aplikasi Monitoring dan Analisis Jemaat Gereja
            </h2>
            <p className="mb-6 text-base leading-relaxed text-gray-600 sm:text-lg">
              Aplikasi ini menyajikan data jemaat dalam bentuk tabel yang mudah
              diakses serta dilengkapi dengan statistik visual seperti grafik
              usia, jumlah kehadiran, dan pertumbuhan jemaat, sehingga
              memudahkan gereja dalam mengelola dan menganalisis informasi
              secara efektif.
            </p>
            <SignedOut>
              <Link href="/login">
                <button className="mt-5 rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700">
                  Lihat lebih lanjut
                </button>
              </Link>
            </SignedOut>
          </div>

          <div className="flex-1 p-4 md:p-0">
            <Image
              src="/pic_sectionAbout.jpeg"
              alt="Gereja"
              width={400}
              height={500}
              className="h-auto w-full rounded-lg shadow-xl"
              unoptimized
            />
          </div>
        </div>
      </section>

      <section
        id="location"
        className="relative flex w-full flex-col-reverse items-center justify-center gap-8 bg-gray-200 px-6 py-10 sm:px-8 md:flex-row md:gap-10 md:px-20"
      >
        <div className="h-[300px] w-full flex-1 overflow-hidden rounded-xl border border-gray-300 shadow-lg sm:h-[400px]">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.505708892226!2d106.5746358750379!3d-6.196627693798544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69fb28e7e1694f%3A0x633d7b4097475d4d!2sGereja%20Kristus%20Indonesia%20Karawaci!5e0!3m2!1sid!2sid!4v1700000000000!5m2!1sid!2sid"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
        <div className="flex-1 p-4 py-10 text-left md:p-0 md:py-28 md:text-left">
          <h2 className="mb-6 text-3xl font-bold text-gray-800 sm:text-4xl md:text-4xl">
            Lokasi Kami
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-base text-gray-600 md:mx-0">
            GKI Karawaci berlokasi di pusat kota yang mudah dijangkau. Silakan
            kunjungi kami untuk ibadah Minggu maupun kegiatan pelayanan lainnya.
          </p>
          <div className="space-y-2 text-base text-gray-700">
            <p>
              <strong>📍 Alamat:</strong> Ruko Villa Permata Blok C1 No. 3&8,
              Binong, Kec. Curug, Kabupaten Tangerang, Banten 15810
            </p>
            <p>
              <strong>☎ Telepon:</strong> (021) 5919627
            </p>
            <p>
              <strong>⏰ Ibadah Minggu (umum):</strong> 07:00 WIB, 10:00 WIB,
              dan 17:00 WIB
            </p>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </MainLayout>
  );
}
