import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'hardware-hub-auth-token',
    // Disable multi-tab session locking which can cause hangs in some browser environments
    lockType: 'cookie'
  }
});

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
