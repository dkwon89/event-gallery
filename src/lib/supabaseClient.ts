import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a fallback client for when environment variables are missing
const createFallbackClient = (): SupabaseClient => {
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

// Lazy initialization to prevent server-side errors
let _supabase: SupabaseClient | null = null

export const supabase = (() => {
  if (_supabase) return _supabase
  
  try {
    if (hasValidSupabaseConfig) {
      _supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
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
    } else {
      _supabase = createFallbackClient()
    }
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    _supabase = createFallbackClient()
  }
  
  return _supabase
})()
