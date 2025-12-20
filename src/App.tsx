import { useEffect, useState } from 'react';
import { Star, Zap, Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { Header } from './components/Header';
import WarRoom from './components/WarRoom';
import WalletModal from './components/WalletModal';
import ChatRoom from './components/ChatRoom';

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
  date?: string; // 比赛日期 (e.g., "December 20")
  homeLogo?: string; // 主队 logo URL
  awayLogo?: string; // 客队 logo URL
  isStarred: boolean;
  tags: string[]; // 这些 tags 只在 War Room 显示，主页不显示
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

const refreshData = (setMatchesFn: (matches: Match[]) => void) => {
  // Simple refresh stub: regenerate mock chart data to simulate fresh odds/metrics
  setMatchesFn(
    INITIAL_MATCHES.map((m) => ({
      ...m,
      chartData: generateWaveData(),
    }))
  );
};

// --- Import full dataset from colleague's Supabase data ---
import { MOCK_MATCHES as GENERATED_MATCHES } from './data/generatedMatches';

// --- Initial Matches (from colleague's Supabase data) ---
// Use all 50 matches from the generated dataset, adding chartData to each
const INITIAL_MATCHES: Match[] = GENERATED_MATCHES.map((match) => ({
  ...match,
  chartData: generateWaveData(),
}));

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'warroom' | 'chat'>('home');
  const [showWallet, setShowWallet] = useState(false);
  const [referrerId, setReferrerId] = useState<number | null>(null);
  const [bannerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vipProcessingMatchId, setVipProcessingMatchId] = useState<number | null>(null);

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
    setIsLoading(true);

    // Safety check: must be opened in Telegram and have a valid Telegram user id
    const tg = window.Telegram?.WebApp;
    const tgUserId = tg?.initDataUnsafe?.user?.id;
    if (
      !tg ||
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
      setIsLoading(false);
      return;
    }

    const sb = supabase;
    if (!sb) {
      tg.showAlert?.('Supabase not ready. Please try again.') ??
        window.alert('Supabase not ready. Please try again.');
      setIsLoading(false);
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
        // Already VIP: enter directly
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

      // Deduct balance and set VIP
      const { error: updateError } = await sb
        .from('users')
        .update({ balance: newBalance, vip_end_time: newVipEnd.toISOString() })
        .eq('telegram_id', user.telegram_id);

      if (updateError) {
        tg.showAlert?.(`❌ ${updateError.message || 'Transaction failed'}`) ??
          showTelegramAlert(`❌ ${updateError.message || 'Transaction failed'}`);
        return;
      }

      // Update local state and enter warroom
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
      setIsLoading(false);
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

    // Always fetch latest coins from DB before applying the delta to avoid stale local state
    const { data: freshUser, error: freshError } = await supabase
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
        isVip={isVipActive(user?.vip_end_time) || Boolean(user?.is_vip)}
        userBalance={user?.coins ?? 0}
      />
    );
  }

  if (currentView === 'chat') {
    if (!user) {
      return (
        <div className="min-h-screen bg-background text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">Please wait while loading user data...</p>
          </div>
        </div>
      );
    }
    
    return (
      <ChatRoom
        currentUser={{ id: user.id, username: user.username || user.first_name }}
        onBack={() => setCurrentView('home')}
        onNavigateToWarRoom={(matchId) => {
          // 找到对应的 match 并导航到 War Room
          const targetMatch = matches.find((m) => m.id === matchId);
          if (targetMatch) {
            setActiveMatch(targetMatch);
            setCurrentView('warroom');
          }
        }}
        // matchId 未提供，将加载全局消息（match_id 为 null）
      />
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

      {/* Bottom navigation: Home / Chat */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-surface/95 backdrop-blur-xl border-t border-white/10 z-40">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (currentView === 'home') {
                refreshData(setMatches);
              } else {
                setCurrentView('home');
              }
            }}
            className={`px-3 py-3 rounded-lg text-xs font-mono border transition-all ${
              currentView === 'home'
                ? 'bg-neon-gold/20 border-neon-gold/50 text-neon-gold'
                : 'bg-surface-highlight border-white/10 text-white hover:border-neon-gold/30'
            }`}
          >
            HOME
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
            className="bg-surface-highlight px-3 py-3 rounded-lg text-xs font-mono border border-neon-gold/30 text-neon-gold hover:border-neon-gold/50 hover:bg-surface-highlight/80 transition-all"
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
              onClick={() => {
                setActiveMatch(match);
                setCurrentView('warroom');
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Date and Time */}
                <div className="w-16 text-center border-r border-white/5 pr-3">
                  {match.date && (
                    <span className="text-[10px] font-mono text-gray-400 block mb-0.5">{match.date}</span>
                  )}
                  <span className="text-xs font-mono text-gray-300 block">{match.time.replace('LIVE', '').trim()}</span>
                  {match.status === 'LIVE' && <span className="text-[8px] text-neon-red font-bold">LIVE</span>}
                </div>
                
                {/* Team Logos and Names */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Home Team */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {match.homeLogo ? (
                      <img src={match.homeLogo} alt={match.home} className="w-5 h-5 object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0"></div>
                    )}
                    <span className="text-sm font-medium text-white truncate">{match.home}</span>
                  </div>
                  
                  {/* Score or VS */}
                  <div className="text-xs text-gray-500 font-mono mx-1 flex-shrink-0">
                    {match.score || 'vs'}
                  </div>
                  
                  {/* Away Team */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium text-white truncate text-right">{match.away}</span>
                    {match.awayLogo ? (
                      <img src={match.awayLogo} alt={match.away} className="w-5 h-5 object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2 text-gray-600 group-hover:text-neon-gold transition-colors ml-2">
                <Star size={18} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {currentView === 'home' && activeMatch && (
          <WarRoom 
            match={activeMatch} 
            onClose={() => setActiveMatch(null)}
            chatUserId={user?.id ?? null}
            chatUsername={user?.username || user?.first_name || null}
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