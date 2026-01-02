import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Cek Session
  const { data: { user } } = await supabase.auth.getUser()

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/statistic') || 
                           request.nextUrl.pathname.startsWith('/databaseUser') ||
                           request.nextUrl.pathname.startsWith('/user');

  // 1. Belum Login
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Sudah Login, Cek Status via API Internal (Prisma)
  if (user && isProtectedRoute) {
    try {
      const baseUrl = request.nextUrl.origin;
      const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Cookie: request.headers.get("cookie") || "" },
      });

      if (res.ok) {
        const userData = await res.json();

        if (userData.isVerified === "pending" || userData.isVerified === "rejected") {
          if (request.nextUrl.pathname !== "/waiting") {
            return NextResponse.redirect(new URL("/waiting", request.url));
          }
        }

        const isAdminRoute = request.nextUrl.pathname.startsWith("/databaseUser");
        if (isAdminRoute && userData.role !== "admin") {
          return NextResponse.redirect(new URL("/unauthorized", request.url));
        }
      }
    } catch (e) {
      console.error("Middleware Error:", e);
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}