import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase secara otomatis menangani pertukaran kode di URL menjadi session di cookies
      const { data, error } = await supabase.auth.getSession();
      
      if (data?.session?.user) {
        // Optional: Cek apakah user sudah ada di database Prisma Anda, jika belum, buat record-nya
        await fetch("/api/auth/sync-google-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: data.session.user.id,
            email: data.session.user.email,
            nama: data.session.user.user_metadata.full_name 
          }),
        });
        
        router.push('/');
      } else {
        router.push('/login?error=Authentication failed');
      }
    };

    handleCallback();
  }, [router]);

  return <div className="flex h-screen items-center justify-center">Memproses login...</div>;
}