// src/app/api/jemaat/route.ts
import { NextResponse } from "next/server";

// Data type sent to the client (tanpa 'kehadiran' field)
export interface JemaatClient {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  statusKehadiran: "Aktif" | "Jarang Hadir" | "Tidak Aktif"; // Status Kehadiran Terhitung
  status: string; // Status Database Asli
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
}

// Tipe data Internal untuk Mock
interface JemaatRaw {
  id: number | string;
  foto: string;
  nama: string;
  jabatan: string;
  status: string;
  tanggalLahir?: string;
  umur?: string;
  keluarga?: string;
  email?: string;
  telepon?: string;
  kehadiranSesi: string;
  attendanceCount: number; // Jumlah kehadiran simulasi
}


const calculateStatusKehadiran = (attendanceCount: number): JemaatClient['statusKehadiran'] => {
  // Asumsi 4 layanan dalam sebulan terakhir
  if (attendanceCount >= 3) { 
    return "Aktif";
  } else if (attendanceCount === 2) { 
    return "Jarang Hadir";
  } else { 
    return "Tidak Aktif";
  }
};

const generateMockJemaat = (count: number): JemaatClient[] => {
    const roles = ["Jemaat", "Majelis", "Diaken", "Pengurus"];
    const databaseStatus = ["Aktif", "Tidak Aktif"];
    const sessions = ["Kebaktian I : 07:00", "Kebaktian II : 10:00", "Kebaktian III : 17:00", "Ibadah Anak : Minggu, 10:00", "Ibadah Remaja : Minggu, 10:00", "Ibadah Pemuda : Minggu, 10:00", "Ibadah Lansia : Sabtu, 10:00", "Ibadah Dewasa : Sabtu, 17:00"];
    
    const mockData: JemaatRaw[] = [];

    for (let i = 1; i <= count; i++) {
        const id = i;
        const firstName = `Jemaat`;
        const lastName = `${String(i).padStart(3, '0')}`;
        const name = `${firstName} ${lastName}`;
        // Gunakan operator nullish coalescing untuk memastikan nilai default
        const jabatan = roles[Math.floor(Math.random() * roles.length)] ?? "Jemaat";
        const status = databaseStatus[Math.floor(Math.random() * databaseStatus.length)] ?? "Aktif";
        // Simulasikan jumlah kehadiran dari 0 hingga 4
        const attendanceCount = Math.floor(Math.random() * 5); 
        // MODIFIED: Ambil sesi lengkap untuk simulasi
        const kehadiranSesi = sessions[Math.floor(Math.random() * sessions.length)] ?? "Kebaktian I : 07:00";
        const email = `${name.replace(/\s/g, '').toLowerCase()}@example.com`;
        const phone = `0812${String(i).padStart(8, '0')}`;
        const age = Math.floor(Math.random() * 60) + 18;
        const birthYear = new Date().getFullYear() - age;
        const tanggalLahir = `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;

        mockData.push({
            id,
            foto: `https://ui-avatars.com/api/?name=${name.replace(/\s/g, '+')}&background=4F46E5&color=fff&size=128`,
            nama: name,
            jabatan,
            status,
            tanggalLahir,
            umur: age.toString(),
            keluarga: `Keluarga ${lastName}`,
            email,
            telepon: phone,
            kehadiranSesi,
            attendanceCount,
        });
    }

    // Proses untuk menambahkan statusKehadiran yang dihitung
    const processedData: JemaatClient[] = mockData.map(j => ({
        id: j.id,
        foto: j.foto,
        nama: j.nama,
        jabatan: j.jabatan,
        status: j.status, 
        statusKehadiran: calculateStatusKehadiran(j.attendanceCount),
        tanggalLahir: j.tanggalLahir,
        umur: j.umur,
        keluarga: j.keluarga,
        telepon: j.telepon,
        kehadiranSesi: j.kehadiranSesi,
        email: j.email,
    }));
    
    return processedData;
};

const processedJemaatData: JemaatClient[] = generateMockJemaat(200);

// App Router Handler: Akses dari client melalui /api/jemaat
export async function GET() {
    return NextResponse.json(processedJemaatData);
}