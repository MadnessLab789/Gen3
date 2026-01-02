import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// --- MAIN SUPABASE (Users, Transactions, Chat) ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;

export const supabase: SupabaseClient | null =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          fetch: (input, init) => {
            return fetch(input, { ...(init ?? {}), cache: 'no-store' });
          },
        },
      })
    : null;

// --- ODDS SUPABASE (Prematches, Handicap, OverUnder, Moneyline) ---
// Using NEXT_PUBLIC_* as requested, falling back to VITE_* for Vite compatibility if needed
const ODDS_URL = (import.meta.env.NEXT_PUBLIC_ODDS_SUPABASE_URL as string | undefined) || (import.meta.env.VITE_ODDS_SUPABASE_URL as string | undefined);
const ODDS_KEY = (import.meta.env.NEXT_PUBLIC_ODDS_SUPABASE_KEY as string | undefined) || (import.meta.env.VITE_ODDS_SUPABASE_KEY as string | undefined);

export const oddsSupabase: SupabaseClient | null =
  typeof ODDS_URL === 'string' &&
  ODDS_URL.length > 0 &&
  typeof ODDS_KEY === 'string' &&
  ODDS_KEY.length > 0
    ? createClient(ODDS_URL, ODDS_KEY, {
        global: {
          fetch: (input, init) => {
            return fetch(input, { ...(init ?? {}), cache: 'no-store' });
          },
        },
      })
    : null;

// ⚠️ IMPORTANT REMINDERS:
// 1. Null Safety: Always check `if (!supabase) return;` or `if (!oddsSupabase) return;`
// 2. Replication: Ensure "Realtime" is enabled for relevant tables in BOTH databases.
