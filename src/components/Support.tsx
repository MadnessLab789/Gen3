import WebApp from '@twa-dev/sdk';
import { ArrowLeft, MessageSquare, ShieldCheck } from 'lucide-react';

function openTelegramUrl(url: string) {
  const u = String(url || '').trim();
  if (!u) return;
  try {
    WebApp.openTelegramLink(u);
    return;
  } catch {
    // ignore
  }
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
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/5 rounded-xl transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">SUPPORT</div>
          <div className="text-lg font-black text-white truncate">Quick Actions</div>
        </div>
      </header>

      <div className="space-y-4">
        <div className="premium-card">
          <div className="premium-card-content">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 font-mono">
              <MessageSquare className="w-4 h-4 text-neon-gold" />
              Quick Actions
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => openTelegramUrl('https://t.me/oddsflow_cs_bot')}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-data hover:brightness-110 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-neon-gold" />
                Telegram Support
              </button>
              <button
                onClick={() => openTelegramUrl('https://t.me/oddsflow_manager_bot')}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-data hover:brightness-110 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-neon-gold" />
                VIP / Upgrade
              </button>
            </div>

            <div className="mt-4 text-[11px] text-gray-500 font-mono leading-relaxed">
              Links open inside Telegram using <span className="text-white">openTelegramLink</span> for best compatibility.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


