import { ArrowLeft, LifeBuoy, MessageCircle, ShieldAlert } from 'lucide-react';

function openTelegramUrl(url: string) {
  const u = String(url || '').trim();
  if (!u) return;
  const tg = (window as any).Telegram?.WebApp;
  try {
    if (typeof tg?.openTelegramLink === 'function') {
      tg.openTelegramLink(u);
      return;
    }
  } catch {
    // ignore
  }
  window.open(u, '_blank');
}

export default function Support(props: {
  onBack: () => void;
  showAlert: (message: string) => void;
}) {
  const { onBack, showAlert: _showAlert } = props;

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
          <div className="text-xs text-gray-400 font-mono">SUPPORT</div>
          <div className="text-lg font-black text-white truncate">Help Center</div>
        </div>
      </header>

      <div className="space-y-4">
        <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 text-neon-gold font-bold text-sm">
            <LifeBuoy size={16} />
            <span>Quick Actions</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => openTelegramUrl('https://t.me/oddsflow_cs_bot')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <MessageCircle size={14} />
              Telegram Support
            </button>
            <button
              onClick={() => openTelegramUrl('https://t.me/oddsflow_manager_bot')}
              className="bg-surface-highlight border border-white/10 rounded-lg px-3 py-3 text-xs font-mono hover:border-neon-gold/40 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <ShieldAlert size={14} />
              VIP / Upgrade
            </button>
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4">
          <div className="text-neon-green font-bold text-sm mb-2">FAQ</div>
          <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
            <div>
              <div className="text-white font-semibold">Why do I see “Waiting for AI Analysis…”?</div>
              <div className="text-gray-400">
                Reports are usually generated about 3 minutes before kickoff. If data hasn’t arrived, the page stays in
                waiting state.
              </div>
            </div>
            <div>
              <div className="text-white font-semibold">Why can’t I see Full Analysis?</div>
              <div className="text-gray-400">Full Analysis details are VIP-only (strategy, reasoning, guru notes).</div>
            </div>
          </div>
        </div>

        <div className="bg-black/30 border border-white/10 rounded-xl p-4">
          <div className="text-[11px] text-gray-400 font-mono">
            Tip: If you still see old UI, fully close and reopen the mini app to refresh cached assets.
          </div>
        </div>
      </div>
    </div>
  );
}


