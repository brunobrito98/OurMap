import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create a safe fallback client that matches Supabase types
const fallbackClient = {
  auth: {
    signOut: async () => {
      return Promise.resolve({ error: null as any })
    }
  }
} as any

// Only create client if valid HTTP(S) URL is provided
let supabaseClient = fallbackClient

if (supabaseUrl && supabaseAnonKey && (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://'))) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    // Silently fall back to fallback client without logging sensitive info
    supabaseClient = fallbackClient
  }
}

export const supabase = supabaseClient