import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: import.meta.env.VITE_SITE_URL 
      ? `${import.meta.env.VITE_SITE_URL}/auth/callback`
      : 'https://ijgf-website-one.vercel.app/auth/callback'
  }
})