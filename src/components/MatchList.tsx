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

function formatHHMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MatchList() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase: SupabaseClient | null = useMemo(() => {
    // Vite will expose NEXT_PUBLIC_* because we set envPrefix in vite.config.ts
    const url =
      (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ??
      (import.meta.env.VITE_SUPABASE_URL as string | undefined);
    const key =
      (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined) ??
      (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  useEffect(() => {
    async function fetchMatches() {
      // 安全检查: 如果没连上 Supabase，直接报错
      if (!supabase) {
        setErrorMsg('Missing Supabase environment variables');
        setLoading(false);
        return;
      }

      try {
        // 读取 matches 表，按时间排序
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .order('start_date', { ascending: true })
          .limit(20);

        if (error) {
          setErrorMsg(error.message);
        } else {
          setMatches((data || []) as MatchRow[]);
        }
      } catch (err: any) {
        setErrorMsg(err?.message ?? 'Unexpected error');
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, [supabase]);

  // 加载中界面
  if (loading)
    return (
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-surface/40 backdrop-blur-md">
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    );

  return (
    <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-surface/40 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] text-gray-400 font-mono tracking-widest">STADIUM MATCH CENTER</div>
          <div className="text-lg font-black text-neon-gold">Live Fixtures</div>
        </div>
        {errorMsg ? <div className="text-xs text-neon-red">{errorMsg}</div> : null}
      </div>

      <div className="max-h-[34vh] overflow-y-auto pr-1 space-y-2">
        {matches.length === 0 ? (
          <div className="text-xs text-gray-400">No matches yet.</div>
        ) : (
          matches.map((m) => (
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
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${
                      (m.status_short ?? '').toUpperCase() === 'LIVE'
                        ? 'bg-neon-red/15 text-neon-red border-neon-red/30'
                        : 'bg-white/5 text-gray-300 border-white/10'
                    }`}
                  >
                    {m.status_short || 'NS'}
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
          ))
        )}
      </div>
    </div>
  );
}