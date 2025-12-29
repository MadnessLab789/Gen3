import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Copy, X } from 'lucide-react';
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

export default function RechargeModal(props: {
  open: boolean;
  onClose: () => void;
  telegramId: number;
  showToast: (msg: string) => void;
}) {
  const { open, onClose, telegramId, showToast } = props;
  const sb = supabase;

  const address = useMemo(() => {
    // Set in Vercel/Env: VITE_USDT_BEP20_ADDRESS
    const env = (import.meta as any)?.env?.VITE_USDT_BEP20_ADDRESS;
    return String(env || '').trim() || 'PLEASE_SET_VITE_USDT_BEP20_ADDRESS';
  }, []);

  const [amount, setAmount] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);

  const quick = [10, 50, 100] as const;

  const handleConfirm = async () => {
    if (!sb) return;
    if (!Number.isFinite(telegramId) || telegramId <= 0) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    setSubmitting(true);
    try {
      const payload = {
        telegram_id: telegramId,
        amount,
        currency: 'USDT',
        network: 'BEP20',
        deposit_address: address,
        status: 'pending',
      };

      const { error } = await sb.from('oddsflow_radar_transactions').insert(payload as any);
      if (error) {
        console.warn('[RechargeModal] insert failed:', error);
        showToast('Failed to submit. Please contact support.');
        return;
      }

      showToast('Submitted. Support is reviewing your transfer.');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            className="fixed inset-x-0 bottom-0 z-[130] max-w-md mx-auto"
          >
            <div className="rounded-t-3xl bg-[#121212] border border-neon-gold/30 shadow-[0_0_30px_rgba(255,215,0,0.15)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="text-sm font-black text-neon-gold uppercase tracking-widest">Recharge</div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" aria-label="Close">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="premium-card">
                  <div className="premium-card-content">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                      USDT (BEP20) Deposit Address
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0 font-mono text-sm text-white break-all">{address}</div>
                      <button
                        onClick={async () => {
                          const ok = await tryCopy(address);
                          showToast(ok ? 'Address copied' : 'Copy failed');
                        }}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:brightness-110 transition"
                      >
                        <Copy className="w-4 h-4 text-neon-gold" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="aspect-square rounded-xl border border-white/10 bg-black/30 flex items-center justify-center text-[10px] font-mono text-gray-500">
                        QR (placeholder)
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                          Quick Amount
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {quick.map((v) => (
                            <button
                              key={v}
                              onClick={() => setAmount(v)}
                              className={`rounded-xl px-2 py-2 text-[11px] font-mono border transition ${
                                amount === v
                                  ? 'bg-neon-gold text-black border-neon-gold'
                                  : 'bg-white/5 text-white border-white/10 hover:border-neon-gold/30'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          Selected: <span className="text-white">{amount} USDT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!sb || submitting}
                  className="w-full py-4 rounded-xl bg-neon-gold text-black font-black hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  I have transferred
                </button>

                <div className="text-[11px] text-gray-500 font-mono leading-relaxed">
                  After you submit, the transaction will be marked as <span className="text-white">pending</span>. Support
                  will review it shortly.
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}


