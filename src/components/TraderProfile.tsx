import { motion } from 'framer-motion';
import { X, Zap, TrendingUp, CheckCircle } from 'lucide-react';

interface TraderProfileProps {
  onClose: () => void;
  trader: {
    id: number;
    name: string;
    roi: string;
    avatar: string;
    history?: string[];
  };
  isFollowing?: boolean;
  onFollow?: () => void;
}

export default function TraderProfile({ onClose, trader, isFollowing = false, onFollow }: TraderProfileProps) {
  // Calculate stats from history
  const history = trader.history || [];
  const winCount = history.filter((h) => h === 'W').length;
  const lossCount = history.filter((h) => h === 'L').length;
  const winRate = history.length > 0 ? Math.round((winCount / history.length) * 100) : 0;
  const avgStake = 200; // Mock data
  const followers = '12k'; // Mock data

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-surface/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="min-h-screen max-w-md mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-neon-gold">{trader.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </header>

        {/* Summary Card */}
        <div className="bg-black/40 rounded-xl p-6 border border-neon-gold/20 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-neon-purple/20 flex items-center justify-center text-4xl">
              {trader.avatar}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-white mb-2">{trader.name}</h3>
              <div className="flex items-center gap-2 text-neon-green">
                <Zap className="w-4 h-4" fill="currentColor" />
                <span className="font-bold font-mono">Pro Trader</span>
              </div>
            </div>
          </div>

          {/* Core Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-highlight/60 rounded-lg p-4 border border-neon-gold/20">
              <div className="text-xs text-gray-400 mb-1">Total ROI</div>
              <div className="text-2xl font-black text-neon-gold font-mono">{trader.roi}</div>
            </div>
            <div className="bg-surface-highlight/60 rounded-lg p-4 border border-neon-green/20">
              <div className="text-xs text-gray-400 mb-1">Win Rate</div>
              <div className="text-2xl font-black text-neon-green font-mono">{winRate}%</div>
            </div>
          </div>
        </div>

        {/* Performance Graph */}
        <div className="bg-black/40 rounded-xl p-6 border border-white/5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-neon-green" />
            <h3 className="text-lg font-bold text-white">Last 10 Signals</h3>
          </div>

          <div className="flex gap-2 flex-wrap">
            {history.length > 0 ? (
              history.map((result, index) => (
                <div
                  key={index}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold ${
                    result === 'W'
                      ? 'bg-neon-green/20 border border-neon-green/50 text-neon-green'
                      : 'bg-neon-red/20 border border-neon-red/50 text-neon-red'
                  }`}
                >
                  {result === 'W' ? '🟢' : '🔴'}
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm">No history available</div>
            )}
          </div>
        </div>

        {/* Stats Breakdown */}
        <div className="bg-black/40 rounded-xl p-6 border border-white/5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Statistics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Avg. Stake</span>
              <span className="text-white font-bold font-mono">${avgStake}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Followers</span>
              <span className="text-white font-bold font-mono">{followers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Wins</span>
              <span className="text-neon-green font-bold font-mono">{winCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Losses</span>
              <span className="text-neon-red font-bold font-mono">{lossCount}</span>
            </div>
          </div>
        </div>

        {/* Bottom Action Button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-surface/95 backdrop-blur-xl border-t border-white/10">
          <button
            onClick={onFollow}
            className={`w-full py-4 rounded-lg font-black text-lg transition-all ${
              isFollowing
                ? 'bg-neon-green/20 text-neon-green border-2 border-neon-green/50'
                : 'bg-gradient-to-r from-neon-gold to-orange-500 text-black hover:shadow-lg hover:shadow-neon-gold/50'
            }`}
          >
            {isFollowing ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                FOLLOWING
              </span>
            ) : (
              'FOLLOW'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

