import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[Belegarth] Missing Supabase env vars. Copy .env.example to .env and fill in your values.'
  );
}

export const supabase = createClient(url || 'http://placeholder', anonKey || 'placeholder');

export const isConfigured = () => Boolean(url && anonKey && !url.includes('placeholder'));
