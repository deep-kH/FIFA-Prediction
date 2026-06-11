import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const resolvedCookies = cookieStore ?? await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return resolvedCookies.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              resolvedCookies.set(name, value, options)
            )
          } catch {
            // Called from Server Component — safe to ignore when middleware refreshes
          }
        },
      },
    }
  )
}
