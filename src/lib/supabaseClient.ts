import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a fallback client for when environment variables are missing
const createFallbackClient = () => {
  return createClient('https://placeholder.supabase.co', 'placeholder-key', {
    global: {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Check if we have valid environment variables
export const hasValidSupabaseConfig = !!(supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' && 
  supabaseAnonKey !== 'placeholder-key')

export const supabase = hasValidSupabaseConfig 
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      global: {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      },
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      // Realtime is disabled by default for better performance
    })
  : createFallbackClient()
