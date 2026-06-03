import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://remcmfnbofyeuowwhqcx.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbWNtZm5ib2Z5ZXVvd3docWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzExNjgsImV4cCI6MjA4OTM0NzE2OH0.Bq9ZUn3tCHms6RHuOg__S0Ys9WFIux1tNEGJ0AnLkdw"

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase