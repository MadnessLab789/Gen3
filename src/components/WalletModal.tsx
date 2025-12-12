import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Clock, CheckCircle, XCircle, ArrowDown, ArrowUp } from 'lucide-react';

interface WalletModalProps {
  onClose: () => void;
  balance: number;
}

interface BetHistoryItem {
  id: number;
  match: string;
  pick: string;
  amount: string;
  status: 'pending' | 'won' | 'lost';
  odds?: number;
}

const mockPendingBets: BetHistoryItem[] = [
  {
    id: 1,
    match: 'Man City vs Liverpool',
    pick: 'Home Win',
    amount: '$100',
    status: 'pending',
    odds: 2.10,
  },
  {
    id: 2,
    match: 'Arsenal vs PSG',
    pick: 'Over 2.5',
    amount: '$50',
    status: 'pending',
    odds: 1.95,
  },
];

const mockSettledBets: BetHistoryItem[] = [
  {
    id: 3,
    match: 'Arsenal vs PSG',
    pick: 'Over 2.5',
    amount: '+$185',
    status: 'won',
    odds: 1.95,
  },
  {
    id: 4,
    match: 'Real Madrid vs Getafe',
    pick: 'Under 3.5',
    amount: '-$50',
    status: 'lost',
    odds: 1.50,
  },
];

export default function WalletModal({ onClose, balance }: WalletModalProps) {
  const [activeHistoryTab, setActiveHistoryTab] = useState<'pending' | 'settled'>('pending');

  const pendingBets = mockPendingBets;
  const settledBets = mockSettledBets;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
      />

      {/* Modal */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 max-w-md mx-auto bg-surface rounded-t-3xl shadow-2xl z-[100] border-t-2 border-neon-gold/30 h-[85vh] flex flex-col"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-600 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b border-white/10">
          <h2 className="text-xl font-black text-neon-gold">MY WALLET</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {/* Balance Card */}
          <div className="bg-black/40 rounded-xl p-6 border border-neon-gold/20 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <DollarSign className="w-4 h-4" />
              <span>Total Balance</span>
            </div>
            <div className="text-4xl font-black text-neon-gold font-mono mb-6">
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className="py-3 px-4 bg-neon-green/20 border border-neon-green/50 text-neon-green font-bold rounded-lg hover:bg-neon-green/30 transition-all flex items-center justify-center gap-2">
                <ArrowDown className="w-4 h-4" />
                Deposit
              </button>
              <button className="py-3 px-4 bg-transparent border-2 border-white/20 text-white font-bold rounded-lg hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                <ArrowUp className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>

          {/* History Section */}
          <div>
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveHistoryTab('pending')}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeHistoryTab === 'pending'
                    ? 'bg-neon-gold text-black shadow-[0_0_16px_rgba(255,194,0,0.35)] border-2 border-neon-gold'
                    : 'bg-white/5 text-gray-400 hover:text-white border-2 border-transparent'
                }`}
              >
                <Clock className="w-4 h-4" />
                Pending ({pendingBets.length})
              </button>
              <button
                onClick={() => setActiveHistoryTab('settled')}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeHistoryTab === 'settled'
                    ? 'bg-neon-gold text-black shadow-[0_0_16px_rgba(255,194,0,0.35)] border-2 border-neon-gold'
                    : 'bg-white/5 text-gray-400 hover:text-white border-2 border-transparent'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Settled
              </button>
            </div>

            {/* List Items */}
            <div className="space-y-3">
              <AnimatePresence mode="wait">
                {activeHistoryTab === 'pending' && (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {pendingBets.map((bet) => (
                      <div
                        key={bet.id}
                        className="bg-surface-highlight/60 rounded-lg p-4 border border-orange-500/30 hover:border-orange-500/50 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-white mb-1">{bet.match}</div>
                            <div className="text-xs text-gray-400">
                              {bet.pick} @ {bet.odds?.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white mb-1">{bet.amount}</div>
                            <div className="text-xs text-orange-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Running</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeHistoryTab === 'settled' && (
                  <motion.div
                    key="settled"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {settledBets.map((bet) => {
                      const isWin = bet.status === 'won';
                      return (
                        <div
                          key={bet.id}
                          className={`rounded-lg p-4 border transition-all ${
                            isWin
                              ? 'bg-neon-green/10 border-neon-green/30'
                              : 'bg-surface-highlight/60 border-neon-red/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white mb-1">{bet.match}</div>
                              <div className="text-xs text-gray-400">
                                {bet.pick} {bet.odds && `@ ${bet.odds.toFixed(2)}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-sm font-bold mb-1 ${
                                  isWin ? 'text-neon-green' : 'text-neon-red'
                                }`}
                              >
                                {bet.amount}
                              </div>
                              <div
                                className={`text-xs flex items-center gap-1 ${
                                  isWin ? 'text-neon-green' : 'text-neon-red'
                                }`}
                              >
                                {isWin ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                <span>{isWin ? 'WON' : 'LOST'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
