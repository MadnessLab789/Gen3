import { motion } from 'framer-motion';
import { X, TrendingUp, CheckCircle, BadgeCheck, Flame } from 'lucide-react';

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

  // Mock but "professional" stats (replace with real values later)
  const profitFactor = 2.4;
  const avgOdds = 2.1;
  const maxDrawdownPct = -8.5;
  const followers = '12.4k';
  const totalProfit = 4200;

  // Current win streak (from most recent results)
  const winStreak = (() => {
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i] === 'W') streak += 1;
      else break;
    }
    return streak;
  })();

  const recentHistory = (() => {
    const base = [
      { leagueIcon: '🏆', matchName: 'Man City vs Liverpool', market: 'HDP -0.25', odds: 1.96 },
      { leagueIcon: '⚽', matchName: 'Arsenal vs PSG', market: 'Over 2.5', odds: 1.89 },
      { leagueIcon: '🌍', matchName: 'Real Madrid vs Getafe', market: '1X2 Home', odds: 2.10 },
    ];
    const recent = history.slice(-3);
    return recent.map((result, idx) => ({
      ...base[idx % base.length],
      result: result as 'W' | 'L',
    }));
  })();

  const chartPoints = [
    { x: 0, y: 78 },
    { x: 28, y: 66 },
    { x: 55, y: 70 },
    { x: 84, y: 52 },
    { x: 112, y: 57 },
    { x: 142, y: 40 },
    { x: 172, y: 44 },
    { x: 202, y: 28 },
    { x: 232, y: 34 },
    { x: 262, y: 18 },
    { x: 300, y: 12 },
  ];
  const polyline = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');

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
          <h2 className="text-xl font-black text-neon-gold">Trader Profile</h2>
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
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-black text-white">{trader.name}</h3>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-neon-blue bg-neon-blue/10 border border-neon-blue/30 px-2 py-0.5 rounded-full">
                  <BadgeCheck className="w-4 h-4" />
                  Verified
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-neon-green bg-neon-green/10 border border-neon-green/30 px-2 py-0.5 rounded-full">
                  Pro Trader
                </span>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-neon-gold bg-neon-gold/10 border border-neon-gold/30 px-2 py-0.5 rounded-full">
                  <Flame className="w-4 h-4" />
                  {Math.max(winStreak, 1)} Win Streak
                </span>
              </div>
            </div>
          </div>

          {/* Core Data */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-highlight/60 rounded-lg p-4 border border-neon-gold/20">
              <div className="text-[11px] text-gray-400 mb-1">Total ROI</div>
              <div className="text-xl font-black text-neon-gold font-mono">{trader.roi}</div>
            </div>

            <div className="bg-surface-highlight/60 rounded-lg p-4 border border-neon-green/20">
              <div className="text-[11px] text-gray-400 mb-1">Win Rate</div>
              <div className="text-xl font-black text-neon-green font-mono">{winRate}%</div>
            </div>

            <div className="bg-surface-highlight/60 rounded-lg p-4 border border-neon-blue/20">
              <div className="text-[11px] text-gray-400 mb-1">Profit Factor</div>
              <div className="text-xl font-black text-neon-blue font-mono">{profitFactor.toFixed(1)}</div>
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-black/40 rounded-xl p-6 border border-white/5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-neon-green" />
            <h3 className="text-lg font-bold text-white">Performance Chart</h3>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-neon-green/20 bg-[#050B14]">
            <div className="absolute inset-0 bg-neon-green/10 blur-[55px] rounded-full"></div>
            <svg viewBox="0 0 300 90" className="relative w-full h-28">
              <defs>
                <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0.35)" />
                  <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="rgba(34,197,94,0.95)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyline}
              />
              <polyline
                fill="url(#pfFill)"
                stroke="none"
                points={`${polyline} 300,90 0,90`}
              />
            </svg>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            Simulated equity curve for trust-building UI (replace with real performance later).
          </div>
        </div>

        {/* Last 10 Signals */}
        <div className="bg-black/40 rounded-xl p-6 border border-white/5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Last 10 Signals</h3>
            <div className="text-xs text-gray-500 font-mono">
              W:{winCount} / L:{lossCount}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-5">
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

          <div className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-3">
            Recent History
          </div>
          <div className="space-y-2">
            {recentHistory.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-surface-highlight/40 border border-white/5 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{item.leagueIcon}</span>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{item.matchName}</div>
                    <div className="text-[11px] text-gray-400 font-mono truncate">
                      {item.market} @ {item.odds.toFixed(2)}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                    item.result === 'W'
                      ? 'bg-neon-green/15 text-neon-green border-neon-green/30'
                      : 'bg-neon-red/15 text-neon-red border-neon-red/30'
                  }`}
                >
                  {item.result === 'W' ? 'WIN' : 'LOSS'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Stats */}
        <div className="bg-black/40 rounded-xl p-6 border border-white/5 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Advanced Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-highlight/40 border border-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Avg. Odds</div>
              <div className="text-lg font-black text-white font-mono">@{avgOdds.toFixed(2)}</div>
            </div>
            <div className="bg-surface-highlight/40 border border-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Max Drawdown</div>
              <div className="text-lg font-black text-neon-red font-mono">{maxDrawdownPct.toFixed(1)}%</div>
            </div>
            <div className="bg-surface-highlight/40 border border-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Followers</div>
              <div className="text-lg font-black text-white font-mono">{followers}</div>
            </div>
            <div className="bg-surface-highlight/40 border border-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Total Profit</div>
              <div className="text-lg font-black text-neon-green font-mono">
                +${totalProfit.toLocaleString('en-US')}
              </div>
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
          <div className="text-center text-[11px] text-gray-400 mt-2">Stop Copying anytime</div>
        </div>
      </div>
    </motion.div>
  );
}

