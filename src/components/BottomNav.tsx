import { motion } from 'framer-motion';
import { Home, MessageCircle, User, Wallet, Zap } from 'lucide-react';

export type MainTab = 'home' | 'radar' | 'chat' | 'wallet' | 'me';

export default function BottomNav(props: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const { activeTab, onChange } = props;

  const isActive = (t: MainTab) => activeTab === t;
  const iconProps = (t: MainTab) => ({
    size: 20,
    strokeWidth: isActive(t) ? 2.5 : 2,
    className: isActive(t) ? 'text-neon-gold' : 'text-gray-500',
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90]">
      <div className="max-w-md mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="relative bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 rounded-2xl px-2 pt-2 pb-2 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
          <div className="grid grid-cols-5 gap-1 items-end">
            <button
              onClick={() => onChange('home')}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors hover:bg-white/5"
              aria-label="Home"
            >
              <Home {...iconProps('home')} />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter ${
                  isActive('home') ? 'text-neon-gold' : 'text-gray-500'
                }`}
              >
                Home
              </span>
            </button>

            <button
              onClick={() => onChange('radar')}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors hover:bg-white/5"
              aria-label="Radar"
            >
              <Zap {...iconProps('radar')} />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter ${
                  isActive('radar') ? 'text-neon-gold' : 'text-gray-500'
                }`}
              >
                Radar
              </span>
            </button>

            {/* Floating center button */}
            <div className="flex items-center justify-center">
              <motion.button
                onClick={() => onChange('chat')}
                whileTap={{ scale: 0.92 }}
                className="w-14 h-14 -translate-y-4 rounded-full bg-neon-gold text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,194,0,0.4)] border border-neon-gold/40"
                aria-label="Global Chat"
              >
                <MessageCircle size={22} strokeWidth={2.5} className="text-black" />
              </motion.button>
            </div>

            <button
              onClick={() => onChange('wallet')}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors hover:bg-white/5"
              aria-label="Wallet"
            >
              <Wallet {...iconProps('wallet')} />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter ${
                  isActive('wallet') ? 'text-neon-gold' : 'text-gray-500'
                }`}
              >
                Wallet
              </span>
            </button>

            <button
              onClick={() => onChange('me')}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors hover:bg-white/5"
              aria-label="Me"
            >
              <User {...iconProps('me')} />
              <span
                className={`text-[10px] font-bold uppercase tracking-tighter ${
                  isActive('me') ? 'text-neon-gold' : 'text-gray-500'
                }`}
              >
                Me
              </span>
            </button>
          </div>

          {/* Label under FAB to match spec without shifting layout */}
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-2 text-center">
            <div
              className={`text-[10px] font-bold uppercase tracking-tighter ${
                isActive('chat') ? 'text-neon-gold' : 'text-gray-500'
              }`}
            >
              Global Chat
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


