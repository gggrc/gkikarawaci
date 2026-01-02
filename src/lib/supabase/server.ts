// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type GetServerSidePropsContext, type NextApiRequest, type NextApiResponse } from "next";

export function createClient(
  context?: GetServerSidePropsContext | { req: NextApiRequest; res: NextApiResponse }
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return context?.req.cookies[name];
        },
        set(name: string, value: string, options: CookieOptions) {
          context?.res.setHeader("Set-Cookie", `${name}=${value}; Path=/; HttpOnly`);
        },
        remove(name: string, options: CookieOptions) {
          context?.res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0`);
        },
      },
    }
  );
}