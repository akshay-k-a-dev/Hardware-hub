import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simplified logging for debugging that doesn't wrap core methods
export const getDbLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('db_logs') || '[]');
  } catch {
    return [];
  }
};

export const clearDbLogs = () => {
  localStorage.removeItem('db_logs');
  console.log('[DB] Logs cleared');
};
