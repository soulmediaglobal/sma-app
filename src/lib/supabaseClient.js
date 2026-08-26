// SMA-app — Supabase client singleton.
// One client instance shared across every page (each page is a separate
// Vite entry, but they all import this same module).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  // Fails loud in dev rather than silently hitting a blank URL.
  // eslint-disable-next-line no-console
  console.error(
    'Supabase env vars missing. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ' +
    '(atau VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
