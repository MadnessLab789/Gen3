import { useEffect, useState } from 'react';
import { Star, Zap, Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { Header } from './components/Header';
import WarRoom from './components/WarRoom';
import WalletModal from './components/WalletModal';

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
  status: 'LIVE' | 'PRE_MATCH';
  score?: string;
  isStarred: boolean;
  tags: string[];
  tagColor?: string;
  analysis: Analysis;
  chartData: any[];
}

// --- Supabase Config ---
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;

const supabase =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// --- Helper Functions ---
function parseReferrerId(startParam: unknown): number | null {
  if (typeof startParam !== 'string') return null;
  const match = /^ref_(\d+)$/.exec(startParam);
  return match ? Number(match[1]) : null;
}

const generateWaveData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    name: i,
    value: 30 + Math.random() * 60,
  }));
};

// --- Mock Data ---
const INITIAL_MATCHES: Match[] = [
  {
    id: 1,
    league: 'Champions League',
    home: 'Arsenal',
    away: 'PSG',
    time: '20:45',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔥 High Vol', '🐳 Whale Alert'],
    tagColor: 'neon-purple',
    analysis: {
      signal: 'OVER 2.5',
      odds: 1.95,
      confidence: 88,
      guruComment: 'Market indicates heavy volume on Over.',
    },
    chartData: generateWaveData(),
  },
  {
    id: 2,
    league: 'Premier League',
    home: 'Man City',
    away: 'Liverpool',
    time: "LIVE 12'",
    status: 'LIVE',
    score: '0-1',
    isStarred: true,
    tags: ['⚡️ Sniper Signal'],
    tagColor: 'neon-green',
    analysis: {
      signal: 'HOME WIN',
      odds: 2.1,
      confidence: 92,
      guruComment: 'Early goal implies strong home comeback.',
    },
    chartData: generateWaveData(),
  },
  {
    id: 3,
    league: 'La Liga',
    home: 'Real Madrid',
    away: 'Getafe',
    time: '22:00',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔒 Defense Heavy'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'UNDER 3.5',
      odds: 1.5,
      confidence: 75,
      guruComment: 'Defensive lineup confirmed.',
    },
    chartData: generateWaveData(),
  },
];

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [referrerId, setReferrerId] = useState<number | null>(null);
  const [bannerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vipProcessingMatchId, setVipProcessingMatchId] = useState<number | null>(null);

  const showTelegramAlert = (message: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(message);
    } else {
      window.alert(message);
    }
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
    if (!user || !supabase) {
      showTelegramAlert('User not ready. Please wait and try again.');
      return;
    }

    // 1) Check VIP status by vip_end_time
    if (isVipActive(user.vip_end_time)) {
      showTelegramAlert('Access Granted');
      setActiveMatch(match);
      return;
    }

    // 2) Non-VIP or expired: always delegate balance validation to backend (RPC)
    setVipProcessingMatchId(match.id);
    try {
      // This is a loading hint (requested)
      console.log('[VIP] Processing payment...');

      const { data, error } = await supabase.rpc('purchase_vip', {
        user_telegram_id: user.id, // user.id is Telegram numeric ID
        cost_amount: 50,
      });

      if (error) {
        console.error('[VIP] purchase_vip RPC failed:', error);
        showTelegramAlert(error.message || 'Payment failed.');
        return;
      }

      const success = Boolean((data as any)?.success);
      const message = (data as any)?.message ? String((data as any).message) : '';

      if (!success) {
        showTelegramAlert(message || 'Payment failed.');
        return;
      }

      // Refresh user row from DB (coins + vip_end_time) after purchase
      const { data: row, error: rowError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', user.telegram_id)
        .maybeSingle();

      if (rowError) {
        console.warn('[VIP] Failed to refresh user after purchase:', rowError);
      }

      const latestCoins = Number((row as any)?.coins ?? (row as any)?.balance ?? user.coins) || 0;
      const latestVipEnd = ((row as any)?.vip_end_time ?? user.vip_end_time ?? null) as
        | string
        | null;

      setUser((prev) =>
        prev
          ? {
              ...prev,
              coins: latestCoins,
              vip_end_time: latestVipEnd,
              is_vip: true,
            }
          : prev
      );

      showTelegramAlert('Welcome! 30 Days Access Added.');
      setActiveMatch(match);
    } catch (e: any) {
      console.error('[VIP] Unexpected error:', e);
      showTelegramAlert(e?.message || 'Payment failed.');
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

      if (!supabase) {
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
        const { data: existing, error: existingError } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', telegramId)
          .maybeSingle();

        if (existingError) throw existingError;

        if (!existing) {
          // 优先尝试插入 coins（新 schema），如果列不存在则 fallback balance（旧 schema）
          const tryCoins = await supabase.from('users').insert({
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
              const tryBalance = await supabase.from('users').insert({
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
          const upd = await supabase
            .from('users')
            .update({ username, first_name: firstName } as any)
            .eq('telegram_id', telegramId);
          if (upd.error) console.warn('[Users] update username/first_name failed:', upd.error);
        }

        // 拉取最新余额（兼容 coins/balance），并映射到前端 user.coins
        const { data: row, error: rowError } = await supabase
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

  // --- Balance Update Logic ---
  const handleUpdateBalance = async (amount: number) => {
    if (!user || !supabase) return;

    // 1. Calculate new balance
    const newCoins = Number(user.coins) + amount;

    // 2. Optimistic UI update
    setUser({ ...user, coins: newCoins });

    // 3. Sync with DB
    const updCoins = await supabase
      .from('users')
      .update({ coins: newCoins } as any)
      .eq('telegram_id', user.telegram_id);

    if (!updCoins.error) return;

    // fallback: balance column
    const msg = String(updCoins.error.message || '').toLowerCase();
    const coinsColumnMissing = msg.includes('column') && msg.includes('coins');
    if (coinsColumnMissing) {
      const updBal = await supabase
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
  const unstarredMatches = matches.filter((m) => !m.isStarred);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-neon-green gap-4">
        <div className="animate-spin text-4xl">⚡️</div>
        <div className="font-mono text-xs tracking-widest">CONNECTING RADAR...</div>
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

        <div className="space-y-2">
          {unstarredMatches.map((match) => (
            <motion.div
              layoutId={`match-${match.id}`}
              key={match.id}
              className="group bg-surface hover:bg-surface-highlight border border-neon-purple/20 rounded-lg p-3 flex items-center justify-between transition-colors cursor-pointer"
              onClick={() => toggleStar(match.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 text-center border-r border-white/5 pr-3">
                  <span className="text-xs font-mono text-gray-400 block">{match.time.replace('LIVE', '')}</span>
                  {match.status === 'LIVE' && <span className="text-[8px] text-neon-red font-bold">LIVE</span>}
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">
                    {match.home} <span className="text-gray-600">vs</span> {match.away}
                  </div>
                  <div className="flex gap-2">
                    {match.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2 text-gray-600 group-hover:text-neon-gold transition-colors">
                <Star size={18} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeMatch && (
          <WarRoom
            match={activeMatch}
            onClose={() => setActiveMatch(null)}
            onUpdateBalance={handleUpdateBalance}
            onVipPurchase={handleVipPurchase}
            isVip={isVipActive(user?.vip_end_time) || Boolean(user?.is_vip)}
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