import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Test connection to supabase - using users table or similar if todos doesnt exist
  const { data: test, error } = await supabase.from('allowed_friends').select().limit(1)

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">CupHub Fantasy Engine</h1>
        <div className="p-4 border border-gray-700 rounded-lg">
          <h2 className="text-xl mb-4">Supabase Connection Status:</h2>
          {error ? (
            <p className="text-red-500">Error connecting: {error.message}</p>
          ) : (
            <p className="text-green-500">Connected to Supabase Successfully!</p>
          )}
        </div>
      </div>
    </main>
  )
}
