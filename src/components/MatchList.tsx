import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type MatchRow = {
  id: number;
  fixture_id: number;
  league_name: string;
  league_logo: string | null;
  home_name: string;
  home_logo: string | null;
  away_name: string;
  away_logo: string | null;
  start_date: string;
  status_short: string;
  score_home: number | null;
  score_away: number | null;
  venue_name: string | null;
};

function formatKickoff(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatHHMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status: string) {
  const s = (status ?? '').toUpperCase();
  if (s === 'LIVE') return 'bg-neon-red/15 text-neon-red border-neon-red/30';
  if (s === 'FT') return 'bg-white/5 text-gray-300 border-white/10';
  if (s === 'NS') return 'bg-neon-gold/10 text-neon-gold border-neon-gold/25';
  return 'bg-neon-purple/15 text-neon-purple border-neon-purple/30';
}

export default function MatchList() {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const sb: SupabaseClient | null = useMemo(() => {
    // Requirements ask for createClient + NEXT_PUBLIC_* envs; this repo is Vite, so we also support VITE_*.
    const viteEnv = (import.meta as any)?.env ?? {};
    const procEnv = (globalThis as any)?.process?.env ?? {};

    const url =
      (procEnv.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ??
      (viteEnv.VITE_SUPABASE_URL as string | undefined) ??
      undefined;

    const key =
      (procEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined) ??
      (procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
      (viteEnv.VITE_SUPABASE_ANON_KEY as string | undefined) ??
      undefined;

    if (typeof url !== 'string' || url.length === 0) return null;
    if (typeof key !== 'string' || key.length === 0) return null;
    return createClient(url, key);
  }, []);

  useEffect(() => {
    if (!sb) return;

    let cancelled = false;
    setLoading(true);
    setErrorText(null);

    void sb
      .from('matches')
      .select('*')
      .order('start_date', { ascending: true })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setErrorText(error.message || 'Failed to load matches');
          return;
        }
        setRows((data ?? []) as MatchRow[]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (!sb) {
      return <div className="text-xs text-gray-400">Supabase not configured.</div>;
    }
    if (loading) return <div className="text-xs text-gray-500">Loading...</div>;
    if (errorText) return <div className="text-xs text-neon-red">{errorText}</div>;
    if (rows.length === 0) {
      return <div className="text-xs text-gray-400">No matches yet.</div>;
    }

    return (
      <div className="space-y-2">
        {rows.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl border border-white/10 bg-surface/55 backdrop-blur-md px-4 py-3 shadow-[0_0_24px_rgba(160,70,255,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-[11px] text-gray-300 truncate">{m.league_name}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${statusBadge(
                    m.status_short
                  )}`}
                >
                  {m.status_short}
                </span>
                <div className="text-[10px] text-gray-500 font-mono">{formatHHMM(m.start_date)}</div>
                {m.league_logo ? (
                  <img
                    src={m.league_logo}
                    alt={m.league_name}
                    className="w-5 h-5 rounded-sm object-contain opacity-90"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {m.home_logo ? (
                    <img
                      src={m.home_logo}
                      alt={m.home_name}
                      className="w-7 h-7 rounded-lg object-contain bg-black/20 border border-white/5"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10" />
                  )}
                  <div className="text-sm font-semibold text-white truncate">{m.home_name}</div>
                </div>

                <div className="text-xs text-gray-500 font-mono">vs</div>

                <div className="flex items-center gap-2 min-w-0">
                  {m.away_logo ? (
                    <img
                      src={m.away_logo}
                      alt={m.away_name}
                      className="w-7 h-7 rounded-lg object-contain bg-black/20 border border-white/5"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10" />
                  )}
                  <div className="text-sm font-semibold text-white truncate">{m.away_name}</div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                {typeof m.score_home === 'number' && typeof m.score_away === 'number' ? (
                  <div className="text-lg font-black text-neon-gold font-mono">
                    {m.score_home}-{m.score_away}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">—</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [errorText, loading, rows]);

  return (
    <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-surface/40 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] text-gray-400 font-mono tracking-widest">STADIUM MATCH CENTER</div>
          <div className="text-lg font-black text-neon-gold">Live Fixtures</div>
        </div>
      </div>

      <div className="max-h-[34vh] overflow-y-auto pr-1">{content}</div>
    </div>
  );
}


