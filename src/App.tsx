import { useEffect, useMemo, useState } from 'react';
import { Star, Zap, Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import WarRoom from './components/WarRoom';
import WalletModal from './components/WalletModal';
import ChatRoom from './components/ChatRoom';
import MatchList from './components/MatchList';
import { supabase } from './supabaseClient';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        showAlert?: (message: string, callback?: () => void) => void;
        initDataUnsafe?: {
          start_param?: unknown;
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
            photo_url?: string;
          };
        };
      };
    };
  }
}

// --- Interface Definitions ---
interface UserProfile {
  id: number; // Telegram numeric ID (used by RPC purchase_vip: user_telegram_id)
  supabase_user_uuid?: string; // optional UUID from users table (if exists)
  telegram_id: number;
  username: string;
  first_name: string;
  photo_url?: string;
  coins: number; // Fixed: Matches database column 'coins'
  is_vip: boolean; // legacy/optional (kept for backward compatibility)
  vip_end_time?: string | null; // timestamp (ISO string) from DB
}

interface Analysis {
  signal: string;
  odds: number;
  confidence: number;
  guruComment?: string;
}

interface Match {
  id: number;
  league: string;
  home: string;
  away: string;
  time: string;
  date: string;
  startDateIso?: string | null;
  status: 'LIVE' | 'PRE_MATCH';
  type: 'Scheduled' | 'In Play' | 'Finished';
  score?: string;
  home_logo?: string | null;
  away_logo?: string | null;
  league_logo?: string | null;
  isStarred: boolean;
  tags: string[];
  tagColor?: string;
  analysis: Analysis;
  chartData: any[];
}

type PreMatchRow = {
  id: number;
  fixture_id?: number | null;
  league_name: string | null;
  league_logo: string | null;
  home_name: string;
  home_logo: string | null;
  away_name: string;
  away_logo: string | null;
  start_date_msia: string | null;
  status_short?: string | null;
  goals_home?: number | null;
  goals_away?: number | null;
  type?: 'Scheduled' | 'In Play' | 'Finished' | string | null;
};

// --- Helper Functions ---
function parseReferrerId(startParam: unknown): number | null {
  if (typeof startParam !== 'string') return null;
  const match = /^ref_(\d+)$/.exec(startParam);
  return match ? Number(match[1]) : null;
}

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMalaysiaTime(value: string | null | undefined): string {
  const d = parseDateSafe(value);
  if (!d) return '--:--';
  try {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kuala_Lumpur',
    });
  } catch {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}

function formatMalaysiaDate(value: string | null | undefined): string {
  const d = parseDateSafe(value);
  if (!d) return '';
  try {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur',
    });
  } catch {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

const generateWaveData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    name: i,
    value: 30 + Math.random() * 60,
  }));
};

const refreshData = (setMatchesFn: (updater: (prev: Match[]) => Match[]) => void) => {
  // Simple refresh stub: regenerate chart data to simulate fresh odds/metrics
  setMatchesFn((prev) =>
    prev.map((m) => ({
      ...m,
      chartData: generateWaveData(),
    }))
  );
};

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'warroom' | 'chat' | 'finished'>('home');
  const [showWallet, setShowWallet] = useState(false);
  const [referrerId, setReferrerId] = useState<number | null>(null);
  const [bannerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vipProcessingMatchId, setVipProcessingMatchId] = useState<number | null>(null);
  const sb = supabase;

  const showTelegramAlert = (message: string) => {
    const tg = window.Telegram?.WebApp;
    try {
      if (tg?.showAlert) {
        tg.showAlert(message);
        return;
      }
    } catch {
      // Some browsers load telegram-web-app.js but do not support WebApp methods.
    }
    window.alert(message);
  };

  const handleVipPurchase = async () => {
    showTelegramAlert('VIP Payment integration coming soon!');
    // Implement actual payment logic here later
  };

  const isVipActive = (vipEndTime: string | null | undefined) => {
    if (!vipEndTime) return false;
    const t = new Date(vipEndTime).getTime();
    if (Number.isNaN(t)) return false;
    return t > Date.now();
  };

  const formatVipDate = (vipEndTime: string | null | undefined) => {
    if (!vipEndTime) return '';
    const d = new Date(vipEndTime);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleEnterWarRoom = async (match: Match) => {
    // Always show WarRoom immediately in browser/dev mode
    setActiveMatch(match);
    setCurrentView('warroom');

    // Dev/browser fallback: if not Telegram, skip checks
    const tg = window.Telegram?.WebApp;
    if (!tg || !sb) {
      return;
    }

    const tgUserId = tg?.initDataUnsafe?.user?.id;
    if (
      typeof tgUserId !== 'number' ||
      !Number.isSafeInteger(tgUserId) ||
      tgUserId <= 0 ||
      !user ||
      typeof user.id !== 'number' ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0 ||
      tgUserId !== user.id
    ) {
      tg?.showAlert?.('Please open in Telegram') ?? window.alert('Please open in Telegram');
      return;
    }

    setVipProcessingMatchId(match.id);

    try {
      // Fetch latest balance and vip_end_time from DB (do not trust local state)
      const { data: freshUser, error: freshError } = await sb
        .from('users')
        .select('balance, vip_end_time')
        .eq('telegram_id', user.telegram_id)
        .single();

      if (freshError || !freshUser) {
        tg.showAlert?.(`❌ ${freshError?.message || 'Failed to fetch user'}`) ??
          showTelegramAlert(`❌ ${freshError?.message || 'Failed to fetch user'}`);
        return;
      }

      const latestBalance = Number((freshUser as any).balance ?? 0);
      const latestVipEnd = (freshUser as any).vip_end_time as string | null | undefined;
      const hasVip =
        latestVipEnd && !Number.isNaN(new Date(latestVipEnd).getTime())
          ? new Date(latestVipEnd).getTime() > Date.now()
          : false;

      if (hasVip) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                coins: latestBalance,
                vip_end_time: latestVipEnd ?? null,
                is_vip: true,
              }
            : prev
        );
        setActiveMatch(match);
        setCurrentView('warroom');
        return;
      }

      // Not VIP: check balance
      if (latestBalance < 50) {
        tg.showAlert?.('Insufficient balance') ?? showTelegramAlert('Insufficient balance');
        return;
      }

      const newBalance = latestBalance - 50;
      const newVipEnd = new Date();
      newVipEnd.setDate(newVipEnd.getDate() + 30);

      const { error: updateError } = await sb
        .from('users')
        .update({ balance: newBalance, vip_end_time: newVipEnd.toISOString() })
        .eq('telegram_id', user.telegram_id);

      if (updateError) {
        tg.showAlert?.(`❌ ${updateError.message || 'Transaction failed'}`) ??
          showTelegramAlert(`❌ ${updateError.message || 'Transaction failed'}`);
        return;
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              coins: newBalance,
              vip_end_time: newVipEnd.toISOString(),
              is_vip: true,
            }
          : prev
      );
      setActiveMatch(match);
      setCurrentView('warroom');
    } catch (e: any) {
      console.error('[VIP] enter warroom error:', e);
      tg.showAlert?.(`❌ ${e?.message || 'Transaction failed'}`) ??
        showTelegramAlert(`❌ ${e?.message || 'Transaction failed'}`);
    } finally {
      setVipProcessingMatchId(null);
    }
  };

  // --- Auth & Init Logic ---
  useEffect(() => {
    const initApp = async () => {
      const tg = window.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();

      // Fallback for browser testing if not in Telegram
      const tgUser =
        tg?.initDataUnsafe?.user || {
          id: 88888888,
          first_name: 'DevUser',
          username: 'dev_testing',
          photo_url: '',
        };

      if (!sb) {
        console.error('Supabase client not initialized.');
        setIsLoading(false);
        return;
      }

      try {
        const telegramId = tgUser.id;
        if (typeof telegramId !== 'number' || !Number.isSafeInteger(telegramId) || telegramId <= 0) {
          throw new Error('Missing Telegram user id (initDataUnsafe.user.id).');
        }
        const username = tgUser.username || '';
        const firstName = tgUser.first_name || '';
        const photoUrl = tgUser.photo_url || '';

        // 关键逻辑：启动时确保 users 表存在该 telegram_id 记录
        // - 不存在：insert（默认 coins/balance=0）
        // - 存在：update username/first_name（防止改名）
        const { data: existing, error: existingError } = await sb
          .from('users')
          .select('*')
          .eq('telegram_id', telegramId)
          .maybeSingle();

        if (existingError) throw existingError;

        if (!existing) {
          // 优先尝试插入 coins（新 schema），如果列不存在则 fallback balance（旧 schema）
          const tryCoins = await sb.from('users').insert({
            telegram_id: telegramId,
            username,
            first_name: firstName,
            photo_url: photoUrl,
            coins: 0,
            is_vip: false,
          });

          if (tryCoins.error) {
            const msg = String(tryCoins.error.message || '').toLowerCase();
            const coinsColumnMissing = msg.includes('column') && msg.includes('coins');
            const isVipColumnMissing = msg.includes('column') && msg.includes('is_vip');
            const photoColumnMissing = msg.includes('column') && msg.includes('photo_url');

            // 如果是因为列不存在导致失败，尝试最小字段 + balance
            if (coinsColumnMissing || isVipColumnMissing || photoColumnMissing) {
              const tryBalance = await sb.from('users').insert({
                telegram_id: telegramId,
                username,
                first_name: firstName,
                balance: 0,
              } as any);

              if (tryBalance.error) throw tryBalance.error;
            } else {
              throw tryCoins.error;
            }
          }
        } else {
          // 更新改名（只更新最常见字段，避免列不存在）
          const upd = await sb
            .from('users')
            .update({ username, first_name: firstName } as any)
            .eq('telegram_id', telegramId);
          if (upd.error) console.warn('[Users] update username/first_name failed:', upd.error);
        }

        // 拉取最新余额（兼容 coins/balance），并映射到前端 user.coins
        const { data: row, error: rowError } = await sb
          .from('users')
          .select('*')
          .eq('telegram_id', telegramId)
          .maybeSingle();
        if (rowError) throw rowError;

        const latestCoins = Number((row as any)?.coins ?? (row as any)?.balance ?? 0) || 0;
        const latestIsVip = Boolean((row as any)?.is_vip ?? false);
        const vipEndTime = ((row as any)?.vip_end_time ?? null) as string | null;

        setUser({
          id: telegramId,
          supabase_user_uuid: (row as any)?.id ? String((row as any).id) : undefined,
          telegram_id: telegramId,
          username,
          first_name: firstName,
          photo_url: photoUrl,
          coins: latestCoins,
          is_vip: latestIsVip,
          vip_end_time: vipEndTime,
        });

        // 3. Handle Referral (Optional: Log only for now)
        const startParam = tg?.initDataUnsafe?.start_param;
        const extractedRefId = parseReferrerId(startParam);
        if (extractedRefId && extractedRefId !== telegramId) {
          setReferrerId(extractedRefId);
          console.log(`🔗 Referred by: ${extractedRefId}`);
        }
      } catch (err) {
        console.error('❌ Auth Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // --- Matches (live) ---
  useEffect(() => {
    let cancelled = false;
    const loadMatches = async () => {
      if (!sb) {
        setMatchesLoading(false);
        setMatchesError('Supabase client not ready');
        return;
      }
      setMatchesLoading(true);
      setMatchesError(null);
      // 表名当前为 "prematches"（不带连字符），如果需要其他别名可再补充
      const tableCandidates = ['prematches'];
      let rowsData: any[] | null = null;
      let lastError: any = null;

      for (const tableName of tableCandidates) {
        const { data, error } = await sb
          .from(tableName)
          .select(
            'id, fixture_id, league_name, league_logo, home_name, home_logo, away_name, away_logo, start_date_msia, status_short, goals_home, goals_away, type',
          )
          .order('start_date_msia', { ascending: true })
          .limit(200);

        if (!error && Array.isArray(data)) {
          rowsData = data;
          break;
        } else {
          lastError = error;
        }
      }

      if (cancelled) return;

      if (!rowsData) {
        console.warn('[pre-matches] load failed, tried:', tableCandidates, 'last error:', lastError);
        const lastMsg = lastError?.message || 'unknown error';
        const url = typeof import.meta !== 'undefined' ? (import.meta.env?.NEXT_PUBLIC_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL || '') : '';
        setMatchesError(
          `Failed to load matches (supabase ${url}): checked tables ${tableCandidates.join(
            ', ',
          )}; last error: ${lastMsg}`,
        );
        setMatches([]);
        setMatchesLoading(false);
        return;
      }

      const rowsRaw = (rowsData ?? []) as PreMatchRow[];
      const rows = rowsRaw.map((row) => {
        const statusCode = String(row.status_short || '').toUpperCase();
        const isFinished = statusCode === 'FT' || statusCode === 'AET' || statusCode === 'PEN';
        const isLive = ['LIVE', '1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(statusCode);
        const startTs = parseDateSafe(row.start_date_msia)?.getTime() ?? null;
        const isPastKick = startTs !== null && startTs < Date.now();
        const normalizedType: Match['type'] =
          row.type === 'In Play' || row.type === 'Finished'
            ? (row.type as Match['type'])
            : isFinished
              ? 'Finished'
              : isLive
                ? 'In Play'
                : isPastKick
                  ? 'Finished'
                  : 'Scheduled';
        return { ...row, type: normalizedType };
      });

      const sortByStartDate = (list: PreMatchRow[]) =>
        [...list].sort((a, b) => {
          const da = parseDateSafe(a.start_date_msia);
          const db = parseDateSafe(b.start_date_msia);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.getTime() - db.getTime();
        });

      const scheduled = rows.filter((m) => m.type === 'Scheduled');
      const inPlay = rows.filter((m) => m.type === 'In Play');
      const finished = rows.filter((m) => m.type === 'Finished');

      const orderedRows = [...sortByStartDate(inPlay), ...sortByStartDate(scheduled), ...sortByStartDate(finished)];

      const mapped = orderedRows.map((m) => {
        const parseScore = (val: unknown) => {
          const n = Number(val);
          return Number.isFinite(n) ? n : null;
        };
        const homeScore = parseScore(m.goals_home);
        const awayScore = parseScore(m.goals_away);
        const score = homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : undefined;
        const type = (m.type as Match['type']) ?? 'Scheduled';
        const timeLabel = type === 'In Play' ? 'LIVE' : type === 'Finished' ? 'FT' : formatMalaysiaTime(m.start_date_msia);
        const dateLabel = formatMalaysiaDate(m.start_date_msia);
        const tags: string[] = [];
        if (type === 'In Play') tags.push('In Play');
        if (type === 'Finished') tags.push('Finished');

        return {
          id: Number(m.fixture_id ?? m.id),
          league: m.league_name ?? 'Unknown League',
          home: m.home_name,
          away: m.away_name,
          time: timeLabel,
          date: dateLabel,
          startDateIso: m.start_date_msia,
          status: type === 'In Play' ? 'LIVE' : 'PRE_MATCH',
          type,
          score,
          home_logo: m.home_logo,
          away_logo: m.away_logo,
          league_logo: m.league_logo,
          isStarred: false,
          tags,
          analysis: {
            signal: '—',
            odds: 0,
            confidence: 0,
          },
          chartData: generateWaveData(),
        } satisfies Match;
      });

      setMatches(mapped);
      if (mapped.length === 0) {
        setMatchesError('No rows returned from pre-matches. Check RLS or table data.');
      }
      setMatchesLoading(false);
    };

    void loadMatches();
    return () => {
      cancelled = true;
    };
  }, [sb]);

  // --- Balance Update Logic ---
  const handleUpdateBalance = async (amount: number) => {
    if (!user || !sb) return;

    // Always fetch latest coins from DB before applying the delta to avoid stale local state
    const { data: freshUser, error: freshError } = await sb
      .from('users')
      .select('coins, balance')
      .eq('telegram_id', user.telegram_id)
      .maybeSingle();

    if (freshError) {
      console.warn('[Balance] Failed to fetch latest balance, fallback to local:', freshError);
    }

    const latestCoins = Number((freshUser as any)?.coins ?? (freshUser as any)?.balance ?? user.coins) || 0;

    // 1. Calculate new balance based on freshest data
    const newCoins = latestCoins + amount;

    // 2. Optimistic UI update
    setUser({ ...user, coins: newCoins });

    // 3. Sync with DB
    const updCoins = await sb
      .from('users')
      .update({ coins: newCoins } as any)
      .eq('telegram_id', user.telegram_id);

    if (!updCoins.error) return;

    // fallback: balance column
    const msg = String(updCoins.error.message || '').toLowerCase();
    const coinsColumnMissing = msg.includes('column') && msg.includes('coins');
    if (coinsColumnMissing) {
      const updBal = await sb
        .from('users')
        .update({ balance: newCoins } as any)
        .eq('telegram_id', user.telegram_id);
      if (updBal.error) {
        console.error('Failed to update balance:', updBal.error);
      }
      return;
    }

    console.error('Failed to update coins:', updCoins.error);
  };

  const toggleStar = (id: number) => {
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, isStarred: !m.isStarred } : m)));
  };

  const starredMatches = matches.filter((m) => m.isStarred);
  const finishedMatches = matches.filter((m) => m.type === 'Finished');
  const unstarredMatches = matches.filter((m) => !m.isStarred && m.type !== 'Finished');
  const navCurrent: 'home' | 'finished' | 'chat' =
    currentView === 'finished' ? 'finished' : currentView === 'chat' ? 'chat' : 'home';
  const groupedFinished = useMemo(() => {
    const groups: { league: string; league_logo?: string | null; matches: Match[] }[] = [];
    const idx = new Map<string, number>();
    for (const m of finishedMatches) {
      const key = (m.league || 'Unknown').trim() || 'Unknown';
      const existing = idx.get(key);
      if (existing === undefined) {
        idx.set(key, groups.length);
        groups.push({ league: key, league_logo: m.league_logo ?? null, matches: [m] });
      } else {
        groups[existing]!.matches.push(m);
        if (!groups[existing]!.league_logo && m.league_logo) groups[existing]!.league_logo = m.league_logo;
      }
    }
    // Show most recent finished first
    for (const group of groups) {
      group.matches.sort((a, b) => {
        const da = parseDateSafe(a.startDateIso);
        const db = parseDateSafe(b.startDateIso);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.getTime() - da.getTime();
      });
    }
    return groups;
  }, [finishedMatches]);
  const groupedUnstarred = useMemo(() => {
    // Preserve the incoming order (already sorted by start_date asc) while grouping by league.
    const groups: { league: string; league_logo?: string | null; matches: Match[] }[] = [];
    const idx = new Map<string, number>();
    for (const m of unstarredMatches) {
      const key = (m.league || 'Unknown').trim() || 'Unknown';
      const existing = idx.get(key);
      if (existing === undefined) {
        idx.set(key, groups.length);
        groups.push({ league: key, league_logo: m.league_logo ?? null, matches: [m] });
      } else {
        groups[existing]!.matches.push(m);
        if (!groups[existing]!.league_logo && m.league_logo) groups[existing]!.league_logo = m.league_logo;
      }
    }
    const priority = (leagueName: string) => {
      const lower = leagueName.toLowerCase();
      if (lower.includes('premier league')) return 0; // EPL always first
      return 1;
    };
    return groups.sort((a, b) => {
      const pa = priority(a.league);
      const pb = priority(b.league);
      if (pa !== pb) return pa - pb;
      return a.league.localeCompare(b.league);
    });
  }, [unstarredMatches]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-neon-green gap-4">
        <div className="animate-spin text-4xl">⚡️</div>
        <div className="font-mono text-xs tracking-widest">CONNECTING RADAR...</div>
      </div>
    );
  }

  if (currentView === 'warroom' && activeMatch) {
    return (
      <WarRoom
        match={activeMatch}
        onClose={() => {
          setActiveMatch(null);
          setCurrentView('home');
        }}
        chatUserId={user?.id ?? null}
        chatUsername={user?.username || user?.first_name || null}
        onUpdateBalance={handleUpdateBalance}
        onVipPurchase={handleVipPurchase}
        isVip={true}
        userBalance={10000}
      />
    );
  }

  if (navCurrent === 'chat') {
    return (
      <div className="min-h-screen bg-background text-white max-w-md mx-auto relative font-sans flex flex-col">
        <MatchList />
        <div className="flex-1">
          <ChatRoom
            roomId="global"
            userId={user?.id ?? null}
            username={user?.username || user?.first_name || null}
            onBack={() => setCurrentView('home')}
          />
        </div>
      </div>
    );
  }

  if (navCurrent === 'finished') {
    return (
      <div className="min-h-screen bg-background text-white pb-20 px-4 pt-6 max-w-md mx-auto relative font-sans">
        <Header onBalanceClick={() => setShowWallet(true)} />

        {/* Bottom navigation: Home / Finished / Chat */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-surface/95 backdrop-blur-xl border-t border-white/10 z-40">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setCurrentView('home')}
              className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-surface-highlight border-white/10 text-white hover:border-neon-gold/30"
            >
              HOME
            </button>
            <button
              onClick={() => setCurrentView('finished')}
              className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-neon-gold/20 border-neon-gold/50 text-neon-gold"
            >
              FINISHED
            </button>
            <button
              onClick={() => {
                const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
                if (typeof tgUserId === 'number') {
                  if (!user || tgUserId !== user.id) {
                    showTelegramAlert('Please open in Telegram');
                    return;
                  }
                  setCurrentView('chat');
                  return;
                }

                if (!user) {
                  window.alert('User not ready yet. Please try again.');
                  return;
                }

                setCurrentView('chat');
              }}
              className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-surface-highlight border-white/10 text-white hover:border-neon-gold/30"
            >
              CHAT
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4 pb-16">
          <h2 className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
            Finished
          </h2>

          {matchesLoading && <div className="text-xs text-gray-400">Loading...</div>}
          {!matchesLoading && matchesError && (
            <div className="text-xs text-neon-red bg-white/5 border border-neon-red/30 rounded-lg px-3 py-2">
              {matchesError}
            </div>
          )}
          {!matchesLoading && !matchesError && finishedMatches.length === 0 && (
            <div className="text-xs text-gray-400">No finished matches yet.</div>
          )}

          {!matchesLoading &&
            !matchesError &&
            groupedFinished.map((group, groupIdx) => (
              <div key={`${group.league}-${groupIdx}`} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  {group.league_logo ? (
                    <img
                      src={group.league_logo}
                      alt={group.league}
                      className="w-4 h-4 object-contain opacity-80"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">{group.league}</div>
                </div>

                <div className="space-y-2">
                  {group.matches.map((match) => (
                    <motion.div
                      layoutId={`match-${match.id}`}
                      key={match.id}
                      className="group bg-surface hover:bg-surface-highlight border border-neon-purple/20 rounded-lg p-3 transition-colors cursor-pointer"
                      onClick={() => toggleStar(match.id)}
                    >
                      <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center w-full">
                        <div className="w-16 text-center border-r border-white/5 pr-3 flex-shrink-0">
                          {match.date && (
                            <span className="text-[10px] font-mono text-gray-500 block">{match.date}</span>
                          )}
                          <span className="text-xs font-mono text-gray-300 block">FT</span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="text-base font-semibold text-white leading-tight break-words">
                              {match.home}
                            </div>
                            <span className="text-gray-500 text-sm flex-shrink-0 pt-0.5">vs</span>
                            <div className="text-base font-semibold text-white leading-tight break-words text-right">
                              {match.away}
                            </div>
                          </div>
                          {match.type !== 'Scheduled' && match.score && (
                            <div className="flex gap-2 flex-wrap items-center">
                              <span className="text-[12px] font-mono bg-white/5 border border-white/10 text-gray-100 px-2.5 py-1 rounded">
                                {match.score}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-2 flex-wrap mt-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                              Finished
                            </span>
                            {match.tags
                              .filter((t) => t !== 'In Play' && t !== 'Finished')
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 flex-shrink-0 justify-end min-w-[96px]">
                          {match.league_logo ? (
                            <img
                              src={match.league_logo}
                              alt={match.league}
                              className="w-5 h-5 object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          {match.home_logo ? (
                            <img
                              src={match.home_logo}
                              alt={match.home}
                              className="w-8 h-8 object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          {match.away_logo ? (
                            <img
                              src={match.away_logo}
                              alt={match.away}
                              className="w-8 h-8 object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <div className="text-gray-600 group-hover:text-neon-gold transition-colors">
                            <Star size={20} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-white pb-20 px-4 pt-6 max-w-md mx-auto relative font-sans"
      data-referrer-id={referrerId ?? undefined}
    >
      <AnimatePresence>
        {bannerMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md"
          >
            <div className="rounded-xl border border-neon-gold/30 bg-surface/90 backdrop-blur-md px-4 py-3 shadow-[0_0_30px_rgba(255,194,0,0.15)]">
              <div className="text-sm font-bold text-neon-gold">{bannerMessage}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header onBalanceClick={() => setShowWallet(true)} />

      {/* Bottom navigation: Home / Finished / Chat */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-surface/95 backdrop-blur-xl border-t border-white/10 z-40">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              refreshData(setMatches);
            }}
            className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-neon-gold/20 border-neon-gold/50 text-neon-gold"
          >
            HOME
          </button>
          <button
            onClick={() => setCurrentView('finished')}
            className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-surface-highlight border-white/10 text-white hover:border-neon-gold/30"
          >
            FINISHED
          </button>
          <button
            onClick={() => {
              // Telegram: enforce identity match. Browser/dev: allow (we already fallback to a DevUser in init logic).
              const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
              // Only treat as "real Telegram WebApp" when we actually have a valid Telegram user id.
              if (typeof tgUserId === 'number') {
                if (!user || tgUserId !== user.id) {
                  showTelegramAlert('Please open in Telegram');
                  return;
                }
                setCurrentView('chat');
                return;
              }

              if (!user) {
                window.alert('User not ready yet. Please try again.');
                return;
              }

              setCurrentView('chat');
            }}
            className="px-3 py-3 rounded-lg text-xs font-mono border transition-all bg-surface-highlight border-neon-gold/30 text-neon-gold hover:border-neon-gold/50 hover:bg-surface-highlight/80"
          >
            CHAT
          </button>
        </div>
      </div>

      <AnimatePresence>
        {starredMatches.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-3 text-neon-gold text-xs font-bold tracking-widest uppercase">
              <Star size={12} fill="currentColor" />
              Watchlist & Signals
            </div>

            <div className="space-y-4">
              {starredMatches.map((match) => (
                <motion.div
                  layoutId={`match-${match.id}`}
                  key={match.id}
                  className="bg-surface/80 backdrop-blur-md border border-neon-purple/20 rounded-xl p-4 shadow-[0_0_20px_rgba(127,86,217,0.1)] relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <Trophy size={10} /> {match.league}
                      </span>
                      <h3 className="text-lg font-bold mt-1">
                        {match.home} <span className="text-gray-500 text-sm">vs</span> {match.away}
                      </h3>
                      {match.status === 'LIVE' && (
                        <span className="text-neon-red font-mono text-xs animate-pulse block mt-1">
                          ● LIVE {match.score}
                        </span>
                      )}
                    </div>
                    <button onClick={() => toggleStar(match.id)}>
                      <Star className="text-neon-gold" fill="#FFC200" size={20} />
                    </button>
                  </div>

                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-neon-green">
                        <Zap size={16} fill="currentColor" />
                        <span className="font-bold font-mono tracking-wider">AI SIGNAL</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-black text-white leading-none">{match.analysis.signal}</span>
                        <span className="text-xs text-neon-blue font-mono">@ {match.analysis.odds}</span>
                      </div>
                    </div>

                    <div className="relative h-40 rounded-lg overflow-hidden mt-4 mb-4 border border-white/5 group-hover:border-neon-purple/50 transition-all bg-[#050B14]">
                      <div className="absolute bottom-[-20%] left-0 right-0 h-1/2 bg-neon-green/20 blur-[40px] rounded-full"></div>
                      <div className="absolute top-[-50%] left-[-20%] w-[140%] h-full bg-neon-blue/10 blur-[60px] rotate-12"></div>
                      {(match.home_logo || match.away_logo || match.league_logo) && (
                        <>
                          {/* Poster-style background using team logos (no external stadium image needed) */}
                          <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/10 to-black/70"></div>
                          <div className="absolute inset-0 flex items-center justify-center gap-10 opacity-80">
                            {match.home_logo ? (
                              <img
                                src={match.home_logo}
                                alt={match.home}
                                className="w-40 h-40 object-contain opacity-20 blur-[0.5px] -rotate-6 -translate-x-2"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : null}
                            {match.away_logo ? (
                              <img
                                src={match.away_logo}
                                alt={match.away}
                                className="w-40 h-40 object-contain opacity-20 blur-[0.5px] rotate-6 translate-x-2"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : null}
                          </div>
                          {match.league_logo ? (
                            <img
                              src={match.league_logo}
                              alt={match.league}
                              className="absolute top-3 right-3 w-8 h-8 object-contain opacity-25 grayscale"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                        </>
                      )}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                          backgroundSize: '40px 40px',
                        }}
                      ></div>
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-neon-red/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse z-10 shadow-[0_0_10px_rgba(255,59,48,0.5)]">
                        <span className="w-1.5 h-1.5 bg-white rounded-full inline-block"></span>
                        LIVE CAM
                      </div>
                      <div className="absolute bottom-3 left-3 z-10">
                        <div className="font-black italic text-2xl text-white tracking-tighter drop-shadow-lg">
                          GAME ON.
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">Real-time Data Feed</div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-500">AI Confidence</span>
                      <span className="text-[10px] text-neon-green font-mono">{match.analysis.confidence}%</span>
                    </div>

                    {match.analysis.guruComment && (
                      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-400 italic">
                        "{match.analysis.guruComment}"
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => void handleEnterWarRoom(match)}
                    disabled={vipProcessingMatchId === match.id}
                    className="w-full mt-3 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-lg"
                  >
                    {vipProcessingMatchId === match.id ? 'Processing payment...' : 'Enter War Room'}{' '}
                    <Activity size={14} />
                  </button>

                  {user?.vip_end_time && isVipActive(user.vip_end_time) && (
                    <div className="mt-2 text-[10px] text-gray-400 font-mono text-center">
                      VIP Valid until: {formatVipDate(user.vip_end_time)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
          <Clock size={12} /> Upcoming / Live
        </h2>

        <div className="space-y-4">
          {matchesLoading && <div className="text-xs text-gray-400">Loading...</div>}
          {!matchesLoading && matchesError && (
            <div className="text-xs text-neon-red bg-white/5 border border-neon-red/30 rounded-lg px-3 py-2">
              {matchesError}
            </div>
          )}
          {!matchesLoading &&
            !matchesError &&
            groupedUnstarred.map((group, groupIdx) => (
              <div key={`${group.league}-${groupIdx}`} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  {group.league_logo ? (
                    <img
                      src={group.league_logo}
                      alt={group.league}
                      className="w-4 h-4 object-contain opacity-80"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">{group.league}</div>
                </div>

                <div className="space-y-2">
                  {group.matches.map((match) => (
                    <motion.div
                      layoutId={`match-${match.id}`}
                      key={match.id}
                      className="group bg-surface hover:bg-surface-highlight border border-neon-purple/20 rounded-lg p-3 flex items-center justify-between transition-colors cursor-pointer"
                      onClick={() => toggleStar(match.id)}
                    >
                        <div className="flex items-center gap-4 w-full">
                          <div className="w-16 text-center border-r border-white/5 pr-3 flex-shrink-0">
                            {match.date && (
                              <span className="text-[10px] font-mono text-gray-500 block">{match.date}</span>
                            )}
                            <span className="text-xs font-mono text-gray-300 block">{match.time}</span>
                            {match.status === 'LIVE' && <span className="text-[8px] text-neon-red font-bold">LIVE</span>}
                          </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1 leading-snug break-words">
                            <div className="text-sm font-medium text-white">
                              {match.home} <span className="text-gray-600">vs</span> {match.away}
                            </div>
                            {match.score ? (
                              <span className="text-[11px] font-mono bg-white/5 border border-white/10 text-gray-100 px-2 py-0.5 rounded">
                                {match.score}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {match.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 flex-shrink-0 justify-end min-w-[90px]">
                        {match.league_logo ? (
                          <img
                            src={match.league_logo}
                            alt={match.league}
                            className="w-5 h-5 object-contain opacity-60 grayscale"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        {match.home_logo ? (
                          <img
                            src={match.home_logo}
                            alt={match.home}
                            className="w-5 h-5 object-contain opacity-90"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        {match.away_logo ? (
                          <img
                            src={match.away_logo}
                            alt={match.away}
                            className="w-5 h-5 object-contain opacity-90"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <div className="text-gray-600 group-hover:text-neon-gold transition-colors">
                          <Star size={18} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      <AnimatePresence>
        {currentView === 'home' && activeMatch && (
          <WarRoom 
            match={activeMatch} 
            onClose={() => {
              setActiveMatch(null);
              setCurrentView('home');
            }}
            chatUserId={user?.id ?? null}
            chatUsername={user?.username || user?.first_name || null}
            onUpdateBalance={handleUpdateBalance}
            onVipPurchase={handleVipPurchase}
            isVip={true}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWallet && <WalletModal balance={user?.coins ?? 0} onClose={() => setShowWallet(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
