import { useEffect, useState } from 'react';
import { Star, Zap, Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WarRoom from './components/WarRoom';
import WalletModal from './components/WalletModal';
import { supabase } from './supabaseClient';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        initData?: string;
        isVersionAtLeast?: (version: string) => boolean;
        requestInvoice?: (
          invoiceLink: string,
          callback: (status: 'paid' | 'failed' | 'cancelled' | string) => void
        ) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        showPopup?: (
          params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text: string }> },
          callback?: (buttonId: string) => void
        ) => void;
        initDataUnsafe?: {
          start_param?: unknown;
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
          };
        };
      };
    };
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseReferrerId(startParam: unknown): number | null {
  if (typeof startParam !== 'string') return null;
  const raw = safeDecodeURIComponent(startParam).trim();
  if (!raw) return null;

  // 期望格式：ref_邀请人ID
  const match = /^ref_(\d+)$/.exec(raw);
  if (!match) return null;

  const referrerIdStr = match[1];
  const referrerIdNum = Number(referrerIdStr);
  if (!Number.isSafeInteger(referrerIdNum) || referrerIdNum <= 0) return null;

  return referrerIdNum;
}

async function loginOrRegisterWithSupabase(args: {
  telegramUserId: number;
  referrerId: number | null;
  onReferralRewarded?: () => void;
}) {
  const telegramId = args.telegramUserId;
  const referrerId = args.referrerId;

  // TODO: 这里建议改成“以 Supabase 为准”的新用户判断（例如：查询/创建用户记录）。
  // 目前项目没有完整的登录/注册表结构，所以先用 localStorage 做一个可验证的 isNewUser 判定：
  // - 第一次在该设备进入：isNewUser=true
  // - 后续进入：isNewUser=false
  const firstSeenKey = `ofr3:first_seen:${telegramId}`;
  const isNewUser = typeof window !== 'undefined' && !window.localStorage.getItem(firstSeenKey);
  if (isNewUser) {
    try {
      window.localStorage.setItem(firstSeenKey, new Date().toISOString());
    } catch {
      // ignore storage failures
    }
  }

  // --- 用户要求的伪代码逻辑（保留在代码里） ---
  if (isNewUser) {
    // 自动注册并赠送初始金币
    // 检查是否有 referrer_id
    if (referrerId) {
      // 调用 Supabase RPC：给邀请人奖励（新用户触发）
      // supabase.rpc('reward_referrer', { referrer_id_input: referrerId, new_user_id_input: telegramId })
      if (!supabase) {
        console.warn(
          '[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Skip reward_referrer RPC.'
        );
        return;
      }

      const { error } = await supabase.rpc('reward_referrer', {
        referrer_id_input: referrerId,
        new_user_id_input: telegramId,
      });

      if (error) {
        console.error('[Referral] reward_referrer RPC failed:', error);
        return;
      }

      console.log(
        `[Referral] reward_referrer RPC success. new_user=${telegramId} referrer=${referrerId}`
      );
      args.onReferralRewarded?.();
    }
  }
}

// --- 辅助函数：生成模拟波浪数据 ---
const generateWaveData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    name: i,
    value: 30 + Math.random() * 60 // 生成 30-90 之间的随机数
  }));
};

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
  chartData: any[]; // 新增：图表数据
}

// --- 数据源 (带图表数据) ---
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
      guruComment: 'Market indicates heavy volume on Over.'
    },
    chartData: generateWaveData()
  },
  {
    id: 2,
    league: 'Premier League',
    home: 'Man City',
    away: 'Liverpool',
    time: 'LIVE 12\'',
    status: 'LIVE',
    score: '0-1',
    isStarred: true, 
    tags: ['⚡️ Sniper Signal'],
    tagColor: 'neon-green',
    analysis: {
      signal: 'HOME WIN',
      odds: 2.10,
      confidence: 92,
      guruComment: 'Early goal implies strong home comeback.'
    },
    chartData: generateWaveData()
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
      odds: 1.50,
      confidence: 75,
      guruComment: 'Defensive lineup confirmed.'
    },
    chartData: generateWaveData()
  }
];

function App() {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [balance, setBalance] = useState(1240);
  const [referrerId, setReferrerId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [vipLevel, setVipLevel] = useState<string | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);

  const showTelegramAlert = (message: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.showAlert) {
      tg.showAlert(message);
      return;
    }
    window.alert(message);
  };

  // Plan B：Telegram Mini App 自动登录/注册（email/password 派生）
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!supabase) {
      setAuthLoading(false);
      setAuthError('Supabase client not configured. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!tg) {
      setAuthLoading(false);
      setAuthError('Not running inside Telegram WebApp.');
      return;
    }

    let cancelled = false;
    (async () => {
      setAuthLoading(true);
      setAuthError(null);
      setSupabaseUserId(null);
      setProfileUsername(null);
      setVipLevel(null);

      try {
        tg.ready?.();
      } catch {
        // ignore
      }

      const telegramUser = tg.initDataUnsafe?.user;
      const telegramId = telegramUser?.id;
      const username = telegramUser?.username ?? null;
      const firstName = telegramUser?.first_name ?? null;

      if (typeof telegramId !== 'number' || !Number.isSafeInteger(telegramId) || telegramId <= 0) {
        setAuthError('Missing Telegram user id in initDataUnsafe.');
        setAuthLoading(false);
        return;
      }

      // 2) 构建登录凭证（Plan B）
      const email = `${telegramId}@oddsflow.user`;
      const password = `oddsflow_secret_${telegramId}`;

      // 3) 先尝试登录
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (cancelled) return;

      let sessionUserId: string | null =
        signInRes.data?.session?.user?.id ?? signInRes.data?.user?.id ?? null;

      // 失败则走注册（仅在“无效凭证/用户不存在”这种典型新用户场景）
      if (!sessionUserId || signInRes.error) {
        const msg = signInRes.error?.message ?? '';
        const isLikelyNewUser =
          msg.toLowerCase().includes('invalid login credentials') ||
          msg.toLowerCase().includes('user not found') ||
          (signInRes.error as any)?.status === 400;

        if (!isLikelyNewUser) {
          console.error('[Auth] signInWithPassword failed:', signInRes.error);
          setAuthError(signInRes.error?.message ?? 'Sign in failed.');
          setAuthLoading(false);
          return;
        }

        const signUpRes = await supabase.auth.signUp({ email, password });
        if (cancelled) return;

        if (signUpRes.error) {
          console.error('[Auth] signUp failed:', signUpRes.error);
          setAuthError(signUpRes.error.message);
          setAuthLoading(false);
          return;
        }

        const authUserId = signUpRes.data?.user?.id ?? null;
        if (!authUserId) {
          setAuthError('Sign up succeeded but missing user id.');
          setAuthLoading(false);
          return;
        }

        // 关键步骤：注册成功后插入 public.users
        const { error: insertError } = await supabase.from('users').insert({
          id: authUserId,
          telegram_id: telegramId,
          username,
          first_name: firstName,
          vip_level: 'free',
        });

        if (insertError) {
          console.warn('[Users] insert failed:', insertError);
          // 不阻塞：auth 已完成，用户表可后续修复/补插
        }

        // signUp 可能不立即返回 session（取决于邮箱确认设置），所以这里优先用 user.id
        sessionUserId = authUserId;
      }

      if (cancelled) return;

      setSupabaseUserId(sessionUserId);

      // 4) 登录成功后读取 users 表 profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('username,vip_level')
        .eq('id', sessionUserId)
        .maybeSingle();

      if (profileError) {
        console.warn('[Users] select profile failed:', profileError);
      } else {
        setProfileUsername((profile as any)?.username ?? null);
        setVipLevel((profile as any)?.vip_level ?? null);
      }

      setAuthLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authAttempt]);

  const handleVipPurchase = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      showTelegramAlert('请在 Telegram 内打开以使用 Stars 支付。');
      return;
    }

    // 需要 Telegram WebApp >= 6.9 才支持 Stars 支付
    const supported = tg.isVersionAtLeast?.('6.9') ?? false;
    if (!supported) {
      showTelegramAlert('当前 Telegram 版本不支持 Stars 支付，请升级客户端。');
      return;
    }

    // 注意：实际支付由你的 Bot 负责
    const invoiceLink = `https://t.me/Oddsflow_minigame_bot?startapp=buy_vip_100stars`;

    if (!tg.requestInvoice) {
      showTelegramAlert('当前环境不支持 Stars 支付（requestInvoice 不可用）。');
      return;
    }

    tg.requestInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        tg.showAlert?.('支付成功，VIP 已激活！') ?? window.alert('支付成功，VIP 已激活！');
      } else if (status === 'failed') {
        tg.showAlert?.('支付失败，请重试。') ?? window.alert('支付失败，请重试。');
      }
      // status === 'cancelled'：无需提示
    });
  };

  useEffect(() => {
    if (!bannerMessage) return;
    const t = window.setTimeout(() => setBannerMessage(null), 4500);
    return () => window.clearTimeout(t);
  }, [bannerMessage]);

  useEffect(() => {
    // 安全初始化 Telegram Web App（仅在 Telegram 环境下存在）
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    try {
      tg.ready?.();
      tg.expand?.();

      const initDataUnsafe = tg.initDataUnsafe;
      const extractedReferrerId = parseReferrerId(initDataUnsafe?.start_param);

      if (extractedReferrerId) {
        setReferrerId(extractedReferrerId);
        console.log('[Referral] referrer_id:', extractedReferrerId);
      } else {
        // 方便排查：如果你带了 start_param 但没解析出来，可以看这里
        if (initDataUnsafe?.start_param) {
          console.log('[Referral] start_param present but invalid:', initDataUnsafe.start_param);
        }
      }

      // 整合登录/注册：把 referrer_id 一起透传给后端处理函数
      const telegramUserId = initDataUnsafe?.user?.id;
      if (typeof telegramUserId === 'number' && Number.isSafeInteger(telegramUserId) && telegramUserId > 0) {
        void loginOrRegisterWithSupabase({
          telegramUserId,
          referrerId: extractedReferrerId,
          onReferralRewarded: () => {
            setBannerMessage('🎉 邀请成功！你的朋友已为你赢得 500 金币，奖励已入账！');
          },
        });
      } else if (telegramUserId != null) {
        console.warn('[Telegram] Invalid telegram user id:', telegramUserId);
      }
    } catch (err) {
      console.warn('[Telegram] WebApp init failed:', err);
    }
  }, []);

  const toggleStar = (id: number) => {
    setMatches(prev => prev.map(m => 
      m.id === id ? { ...m, isStarred: !m.isStarred } : m
    ));
  };

  const starredMatches = matches.filter(m => m.isStarred);
  const unstarredMatches = matches.filter(m => !m.isStarred);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-lg font-black text-neon-gold">Signing in…</div>
          <div className="text-xs text-gray-400 mt-2">Plan B • Telegram → Supabase</div>
        </div>
      </div>
    );
  }

  if (!supabaseUserId) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-surface/80 border border-white/10 rounded-xl p-5">
          <div className="text-lg font-black text-neon-red mb-2">Login Failed</div>
          <div className="text-sm text-gray-300 break-words">
            {authError ?? 'Unknown error'}
          </div>
          <button
            onClick={() => setAuthAttempt((v) => v + 1)}
            className="w-full mt-4 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black rounded-lg"
          >
            Retry Login
          </button>
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
      
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter text-neon-green">
            ODDSFLOW<span className="text-white not-italic text-sm font-normal ml-1">AI</span>
          </h1>
          <div className="text-[10px] text-gray-400 font-mono mt-1">
            Hi, <span className="text-white">{profileUsername ?? '...'}</span>{' '}
            <span className="text-gray-500">(Level: {vipLevel ?? '...'})</span>
          </div>
        </div>
        <button
          onClick={() => setShowWallet(true)}
          className="bg-surface-highlight px-3 py-1 rounded-full text-xs font-mono border border-neon-gold/30 text-neon-gold hover:border-neon-gold/50 hover:bg-surface-highlight/80 transition-all cursor-pointer"
        >
          BAL: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </button>
      </header>

      <AnimatePresence>
        {starredMatches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3 text-neon-gold text-xs font-bold tracking-widest uppercase">
              <Star size={12} fill="currentColor" />
              Watchlist & Signals
            </div>
            
            <div className="space-y-4">
              {starredMatches.map(match => (
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
                      <h3 className="text-lg font-bold mt-1">{match.home} <span className="text-gray-500 text-sm">vs</span> {match.away}</h3>
                      {match.status === 'LIVE' && <span className="text-neon-red font-mono text-xs animate-pulse block mt-1">● LIVE {match.score}</span>}
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
                    
                    {/* --- 比赛氛围海报 (纯 CSS 绘制版) --- */}
                    <div className="relative h-40 rounded-lg overflow-hidden mt-4 mb-4 border border-white/5 group-hover:border-neon-purple/50 transition-all bg-[#050B14]">
                      
                      {/* 1. 底部绿色光晕 (模拟草坪) */}
                      <div className="absolute bottom-[-20%] left-0 right-0 h-1/2 bg-neon-green/20 blur-[40px] rounded-full"></div>
                      
                      {/* 2. 顶部聚光灯效果 (模拟球场灯光) */}
                      <div className="absolute top-[-50%] left-[-20%] w-[140%] h-full bg-neon-blue/10 blur-[60px] rotate-12"></div>
                      
                      {/* 3. 科技感网格线 (装饰) */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                          backgroundSize: '40px 40px',
                        }}
                      ></div>

                      {/* LIVE 标签 */}
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-neon-red/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse z-10 shadow-[0_0_10px_rgba(255,59,48,0.5)]">
                        <span className="w-1.5 h-1.5 bg-white rounded-full inline-block"></span>
                        LIVE CAM
                      </div>

                      {/* 氛围文字 */}
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
                    onClick={() => setActiveMatch(match)}
                    className="w-full mt-3 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-lg"
                  >
                    Enter War Room <Activity size={14} />
                  </button>
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
          {unstarredMatches.map(match => (
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
                    {match.tags.map(tag => (
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

      {/* War Room Modal */}
      <AnimatePresence>
        {activeMatch && (
          <WarRoom 
            match={activeMatch} 
            onClose={() => setActiveMatch(null)}
            onUpdateBalance={(amount) => setBalance(prev => prev + amount)}
            onVipPurchase={handleVipPurchase}
          />
        )}
      </AnimatePresence>

      {/* Wallet Modal */}
      <AnimatePresence>
        {showWallet && (
          <WalletModal balance={balance} onClose={() => setShowWallet(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;