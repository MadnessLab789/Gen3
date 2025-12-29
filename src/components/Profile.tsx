import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, Copy, Crown, History, LifeBuoy, Settings, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';

function tryCopy(text: string): Promise<boolean> {
  const v = text.trim();
  if (!v) return Promise.resolve(false);

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(v)
      .then(() => true)
      .catch(() => false);
  }

  try {
    const el = document.createElement('textarea');
    el.value = v;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

export default function Profile(props: {
  user: {
    id: number;
    username: string;
    first_name: string;
    photo_url?: string;
    coins: number;
    vip_end_time?: string | null;
    is_vip?: boolean;
  } | null;
  isVip: boolean;
  onBack?: () => void;
  showBack?: boolean;
  showAlert: (message: string) => void;
  onOpenVip?: () => void;
  onOpenSupport?: () => void;
  onOpenWallet?: () => void;
  onOpenRecharge?: () => void;
  watchlistCount?: number;
}) {
  const {
    user,
    isVip,
    onBack,
    showBack = true,
    showAlert,
    onOpenVip,
    onOpenSupport,
    onOpenWallet,
    onOpenRecharge,
    watchlistCount,
  } = props;

  const displayName = user?.username ? `@${user.username}` : user?.first_name || 'Guest';
  const balance = Number.isFinite(Number(user?.coins)) ? Number(user?.coins) : 0;
  const labelCls = 'text-[10px] uppercase tracking-widest text-gray-500';
  const gold = '#FFD700';
  const pillBtnCls =
    'h-9 px-4 rounded-xl text-xs font-black bg-[#FFD700] text-black hover:brightness-110 transition';

  // --- Simple Toast ---
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // --- Referral data ---
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCount, setReferralCount] = useState<number>(0);
  const referralLink = useMemo(() => {
    const code = referralCode.trim();
    if (!code) return '';
    return `https://t.me/OddsFlow_Radar_V3_bot?start=${encodeURIComponent(code)}`;
  }, [referralCode]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    if (!user?.id) return;

    let cancelled = false;
    const load = async () => {
      // A) referral_code from users
      const { data: userRow, error: userErr } = await sb
        .from('users')
        .select('referral_code')
        .eq('telegram_id', user.id)
        .maybeSingle();

      if (!cancelled) {
        if (!userErr) {
          setReferralCode(String((userRow as any)?.referral_code ?? '').trim());
        } else {
          console.warn('[Profile] referral_code fetch failed:', userErr);
        }
      }

      // B) referral count from oddsflow_radar_referrals (try common column names)
      const tryCount = async (col: string) => {
        const res = await sb
          .from('oddsflow_radar_referrals')
          .select('id', { count: 'exact', head: true })
          .eq(col, user.id as any);
        if (res.error) return null;
        return res.count ?? 0;
      };

      const c1 = await tryCount('referrer_telegram_id');
      const c2 = c1 === null ? await tryCount('referrer_id') : null;
      const c3 = c1 === null && c2 === null ? await tryCount('telegram_id') : null;

      if (!cancelled) {
        const next = c1 ?? c2 ?? c3 ?? 0;
        setReferralCount(Number(next) || 0);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const daysUntilVipExpiry = (() => {
    if (!isVip) return null;
    const raw = user?.vip_end_time;
    if (!raw) return null;
    const end = new Date(raw).getTime();
    if (Number.isNaN(end)) return null;
    const diffMs = end - Date.now();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(days, 0);
  })();

  const shortcuts = [
    {
      key: 'alerts',
      label: 'Notifications / Alerts',
      Icon: Bell,
      onClick: () => showAlert('Notifications / Alerts coming soon.'),
    },
    {
      key: 'watchlist',
      label: 'Watchlist',
      Icon: Star,
      onClick: () => showAlert('Watchlist is available on Home (star icon).'),
    },
    {
      key: 'history',
      label: 'History',
      Icon: History,
      onClick: () => showAlert('History coming soon.'),
    },
    {
      key: 'settings',
      label: 'Settings',
      Icon: Settings,
      onClick: () => showAlert('Settings coming soon.'),
    },
    {
      key: 'support',
      label: 'Support',
      Icon: LifeBuoy,
      onClick: () => onOpenSupport?.() ?? showAlert('Support page not configured yet.'),
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans">
      <header className="flex items-center gap-3 mb-6">
        {showBack && onBack ? (
          <button
            onClick={onBack}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        ) : null}
        <div className="min-w-0">
          <div className={`${labelCls} font-mono`}>PROFILE</div>
          <div
            className="text-lg font-black text-white truncate"
            style={{
              textShadow: displayName.startsWith('@') ? `0 0 10px rgba(255,215,0,0.22)` : undefined,
            }}
          >
            {displayName}
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {toast && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-md">
            <div className="rounded-xl border border-white/10 bg-[#161616] px-4 py-3 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <div className="text-sm font-bold text-white">{toast}</div>
            </div>
          </div>
        )}

        {/* Header Card */}
        <div className="relative overflow-hidden rounded-xl bg-[#161616] border border-white/5 p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(139,92,246,0.22),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,215,0,0.10),transparent_45%)]" />
          <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={`${labelCls} font-mono`}>ACCOUNT</div>
              <div
                className="text-2xl font-black text-white truncate"
                style={{ textShadow: `0 0 12px rgba(255,215,0,0.22)` }}
              >
                {displayName}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-9 inline-flex items-center px-3 rounded-xl text-xs font-black border ${
                    isVip ? 'border-[#4ADE80]/30 text-[#4ADE80] bg-transparent' : 'border-white/10 text-gray-300 bg-transparent'
                  }`}
                >
                  {isVip ? 'VIP ACTIVE' : 'FREE'}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {isVip
                    ? daysUntilVipExpiry !== null
                      ? `Expires in ${daysUntilVipExpiry} Days`
                      : 'Expiry unavailable'
                    : 'Upgrade to unlock full analysis'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onOpenVip?.() ?? showAlert('VIP page not configured yet.')}
              className={`${pillBtnCls} flex items-center gap-2 shrink-0`}
            >
              <Crown size={14} />
              VIP
            </button>
          </div>

          {/* Wallet Stats Row */}
          <div className="mt-5 rounded-xl bg-[#161616] border border-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex justify-between items-center">
              <div>
                <div className={`${labelCls} font-mono`}>Wallet Balance</div>
                <div
                  className="text-lg font-black font-mono tracking-tight tabular-nums"
                  style={{ color: gold, textShadow: `0 0 6px rgba(255,215,0,0.18)` }}
                >
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => onOpenRecharge?.() ?? onOpenWallet?.() ?? showAlert('Wallet actions coming soon.')}
                className={pillBtnCls}
              >
                OPEN
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-5 grid grid-cols-3 rounded-xl bg-[#161616] border border-white/5 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {[
              { label: 'VIP', value: isVip ? 'ACTIVE' : 'FREE' },
              { label: 'WATCHLIST', value: String(watchlistCount ?? 0) },
              { label: 'TG ID', value: user?.id ? String(user.id) : '-' },
            ].map((s, idx) => (
              <div
                key={s.label}
                className={`px-4 py-4 min-w-0 overflow-hidden ${idx !== 2 ? 'border-r border-white/10' : ''}`}
              >
                <div className={labelCls}>{s.label}</div>
                {s.label === 'TG ID' ? (
                  <div className="text-sm text-white mt-1 font-data tabular-nums break-all leading-tight">
                    {s.value}
                  </div>
                ) : (
                  <div className="text-lg font-black text-white mt-1 font-mono tabular-nums">{s.value}</div>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="relative overflow-hidden rounded-xl bg-[#161616] border border-white/5 p-4 shadow-[0_0_0_1px_rgba(139,92,246,0.14)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(139,92,246,0.16),transparent_55%)]" />
          <div className="relative">
          <div className={`${labelCls} font-mono mb-3`}>SHORTCUTS</div>
          <div className="space-y-2">
            {shortcuts.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className="w-full bg-[#161616] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between hover:scale-105 transition-transform hover:brightness-110"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A0A0A] border border-[rgba(139,92,246,0.22)] flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.12)]">
                    <Icon size={16} style={{ color: gold }} />
                  </div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* Referral / Invite */}
        <div className="premium-card">
          <div className="premium-card-content">
            <div className="flex items-center justify-between">
              <div className={labelCls}>INVITE</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                Invited: <span className="text-white font-bold">{referralCount}</span>
              </div>
            </div>

            <div className="mt-2 text-sm font-semibold text-white">Your Referral Link</div>

            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={referralLink || 'No referral_code found on users table.'}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-[12px] text-white font-mono tabular-nums"
              />
              <button
                onClick={async () => {
                  if (!referralLink) {
                    setToast('Missing referral code');
                    return;
                  }
                  const ok = await tryCopy(referralLink);
                  setToast(ok ? 'Copied!' : 'Copy failed');
                }}
                className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 hover:brightness-110 transition flex items-center gap-2"
                aria-label="Copy"
              >
                <Copy className="w-4 h-4" style={{ color: gold }} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-300">COPY</span>
              </button>
            </div>

            <div className="mt-3 text-[11px] text-gray-500 font-mono leading-relaxed">
              Share this link with friends. When they start the bot using your code, it will count as a referral.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


