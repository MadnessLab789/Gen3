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
    <div className="min-h-screen bg-background text-white pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans">
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
          <div className="text-xs text-gray-400 font-mono">PROFILE</div>
          <div
            className="text-lg font-black text-white truncate"
            style={{ textShadow: displayName.startsWith('@') ? '0 0 10px rgba(255,194,0,0.25)' : undefined }}
          >
            {displayName}
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {/* Header Card */}
        <div className="rounded-2xl bg-zinc-900 border border-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] text-gray-400 font-mono">ACCOUNT</div>
              <div
                className="text-2xl font-black text-white truncate"
                style={{ textShadow: '0 0 12px rgba(255,194,0,0.28)' }}
              >
                {displayName}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded-full border ${
                    isVip
                      ? 'text-neon-green border-neon-green/30 bg-neon-green/10'
                      : 'text-gray-300 border-white/10 bg-white/5'
                  }`}
                >
                  {isVip ? 'VIP ACTIVE' : 'FREE'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
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
              className="bg-neon-gold text-black font-black px-4 py-2 rounded-full text-xs flex items-center gap-2 shrink-0"
            >
              <Crown size={14} />
              VIP
            </button>
          </div>

          {/* Wallet Stats Row */}
          <div className="mt-5 rounded-xl bg-black/30 border border-white/5 p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[11px] text-gray-400 font-mono">Wallet Balance</div>
                <div className="text-xl font-black text-neon-gold font-mono">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => onOpenWallet?.() ?? showAlert('Wallet actions coming soon.')}
                className="bg-neon-gold text-black font-black px-4 py-2 rounded-full text-xs"
              >
                OPEN
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-5 grid grid-cols-3 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
            {[
              { label: 'VIP', value: isVip ? 'ACTIVE' : 'FREE' },
              { label: 'WATCHLIST', value: String(watchlistCount ?? 0) },
              { label: 'TG ID', value: user?.id ? String(user.id) : '-' },
            ].map((s, idx) => (
              <div
                key={s.label}
                className={`px-4 py-4 ${idx !== 2 ? 'border-r border-white/10' : ''}`}
              >
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                  {s.label}
                </div>
                <div className="text-lg font-black text-white mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="rounded-2xl bg-zinc-900 border border-white/5 p-4">
          <div className="text-xs text-gray-400 font-mono mb-3">SHORTCUTS</div>
          <div className="space-y-2">
            {shortcuts.map(({ key, label, Icon, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between hover:scale-105 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon size={16} className="text-neon-gold" />
                  </div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/30 border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-gray-400 font-mono">
            Invite link & referrals can be added here next (Profile → Invite).
          </div>
        </div>
      </div>
    </div>
  );
}


