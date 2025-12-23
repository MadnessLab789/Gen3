import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT:
// Use `import.meta.env.VITE_*` directly so Vite can statically replace env vars at build time.
// Avoid `(import.meta as any).env` which can prevent replacement and break in some WebViews.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;

export const supabase: SupabaseClient | null =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          // Nuclear: avoid any browser/network caching layers for REST calls
          fetch: (input, init) => {
            return fetch(input, { ...(init ?? {}), cache: 'no-store' });
          },
        },
      })
    : null;

// ⚠️ IMPORTANT REMINDERS:
// 1. Null Safety: Always check `if (!supabase) return;` before using the client
//    Example: const sb = supabase; if (!sb) return;
//
// 2. Realtime Setup:
//    - Go to Supabase Dashboard > Database > Replication
//    - Enable "Realtime" for `global_messages` and `war_room_messages`
//    - Without this, frontend listeners won't receive INSERT events
//
// 3. Performance: Initial message loading is limited to 50 messages (HISTORY_LIMIT)
//    Messages are sorted by created_at DESC to show newest first


