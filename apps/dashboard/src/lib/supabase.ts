import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('dummy') &&
    supabaseUrl.startsWith('http')
);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;
