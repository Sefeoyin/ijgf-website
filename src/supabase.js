import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jsmgenhhirvgkmsxxpng.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbWdlbmhoaXJ2Z2ttc3h4cG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTAwMDIsImV4cCI6MjA4NjI2NjAwMn0.B4dwjSsY-WghZv4NDMNDhhzzwLPbXlmTGil-3fpYFN0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)