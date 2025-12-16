import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT:
// Use `import.meta.env.VITE_*` directly so Vite can statically replace env vars at build time.
// Avoid `(import.meta as any).env` which can prevent replacement and break in some WebViews.
//
// Vercel note:
// - This is a Vite app, but we allow Vercel/Next-style public env vars too.
// - `vite.config.ts` must include `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` for the NEXT_PUBLIC vars to be exposed.
// - Set either:
//   - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//   - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ??
  undefined;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  undefined;

export const supabase: SupabaseClient | null =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;


