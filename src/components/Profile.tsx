import { ArrowLeft, Bell, ChevronRight, Crown, History, LifeBuoy, Settings, Star } from 'lucide-react';

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
    watchlistCount,
  } = props;

  const displayName = user?.username ? `@${user.username}` : user?.first_name || 'Guest';
  const balance = Number.isFinite(Number(user?.coins)) ? Number(user?.coins) : 0;
  const labelCls = 'text-[10px] uppercase tracking-widest text-gray-500';
  const gold = '#FFD700';
  const pillBtnCls =
    'h-9 px-4 rounded-xl text-xs font-black bg-[#FFD700] text-black hover:brightness-110 transition';

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
        {/* Header Card */}
        <div className="rounded-xl bg-[#161616] border border-white/5 p-6">
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
          <div className="mt-5 rounded-xl bg-[#161616] border border-white/5 p-4">
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
                onClick={() => onOpenWallet?.() ?? showAlert('Wallet actions coming soon.')}
                className={pillBtnCls}
              >
                OPEN
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-5 grid grid-cols-3 rounded-xl bg-[#161616] border border-white/5 overflow-hidden">
            {[
              { label: 'VIP', value: isVip ? 'ACTIVE' : 'FREE' },
              { label: 'WATCHLIST', value: String(watchlistCount ?? 0) },
              { label: 'TG ID', value: user?.id ? String(user.id) : '-' },
            ].map((s, idx) => (
              <div
                key={s.label}
                className={`px-4 py-4 ${idx !== 2 ? 'border-r border-white/10' : ''}`}
              >
                <div className={labelCls}>{s.label}</div>
                <div className="text-lg font-black text-white mt-1 font-mono tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="rounded-xl bg-[#161616] border border-white/5 p-4">
          <div className={`${labelCls} font-mono mb-3`}>SHORTCUTS</div>
          <div className="space-y-2">
            {shortcuts.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className="w-full bg-[#161616] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between hover:scale-105 transition-transform hover:brightness-110"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A0A0A] border border-white/10 flex items-center justify-center">
                    <Icon size={16} style={{ color: gold }} />
                  </div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#161616] border border-white/5 p-4">
          <div className="text-[11px] text-gray-500 font-mono">
            Invite link & referrals can be added here next (Profile → Invite).
          </div>
        </div>
      </div>
    </div>
  );
}


