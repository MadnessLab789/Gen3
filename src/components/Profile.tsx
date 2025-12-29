import { ArrowLeft, Bell, Crown, History, Settings, Star } from 'lucide-react';

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
  onBack: () => void;
  showAlert: (message: string) => void;
  onOpenVip?: () => void;
}) {
  const { user, isVip, onBack, showAlert, onOpenVip } = props;

  const displayName = user?.username ? `@${user.username}` : user?.first_name || 'Guest';

  return (
    <div className="min-h-screen bg-background text-white pb-[88px] px-4 pt-6 max-w-md mx-auto relative font-sans">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="min-w-0">
          <div className="text-xs text-gray-400 font-mono">PROFILE</div>
          <div className="text-lg font-black text-white truncate">{displayName}</div>
        </div>
      </header>

      <div className="space-y-4">
        <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 font-mono">VIP STATUS</div>
              <div className={`text-sm font-black ${isVip ? 'text-neon-green' : 'text-gray-300'}`}>
                {isVip ? 'ACTIVE' : 'FREE'}
              </div>
              {isVip && user?.vip_end_time && (
                <div className="text-[11px] text-gray-400 font-mono mt-1">Valid until: {user.vip_end_time}</div>
              )}
            </div>
            <button
              onClick={() => onOpenVip?.() ?? showAlert('VIP page not configured yet.')}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-xs flex items-center gap-2"
            >
              <Crown size={14} />
              VIP
            </button>
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <div className="text-xs text-gray-400 font-mono mb-3">SHORTCUTS</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => showAlert('Notifications / Alerts coming soon.')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2"
            >
              <Bell size={14} />
              Alerts
            </button>
            <button
              onClick={() => showAlert('Watchlist is available on Home (star icon).')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2"
            >
              <Star size={14} />
              Watchlist
            </button>
            <button
              onClick={() => showAlert('History coming soon.')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2"
            >
              <History size={14} />
              History
            </button>
            <button
              onClick={() => showAlert('Settings coming soon.')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2"
            >
              <Settings size={14} />
              Settings
            </button>
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


