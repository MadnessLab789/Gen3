import { useEffect, useState, useMemo } from 'react';
import { Zap, TrendingUp, Search, Info, X as XIcon, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { oddsSupabase } from '../supabaseClient';
import OddsChart from './OddsChart';

interface RadarSignal {
  id: string;
  fixture_id: number;
  league_name: string;
  home_name: string;
  away_name: string;
  clock: string;
  signal_type: 'IN-PLAY' | 'NEXT GOAL' | 'HANDICAP' | string;
  prediction: string;
  odds: number;
  confidence: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
}

type FilterType = 'ALL' | 'IN-PLAY' | 'NEXT GOAL' | 'HANDICAP';

export default function RadarScreen(props: {
  onBalanceClick: () => void;
  hideBalance?: boolean;
}) {
  const { onBalanceClick, hideBalance = false } = props;

  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedSignal, setSelectedSignal] = useState<RadarSignal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Fetch and Realtime Subscription
  useEffect(() => {
    const sb = oddsSupabase;
    if (!sb) return;

    const fetchSignals = async () => {
      setIsLoading(true);
      const { data, error } = await sb
        .from('radar_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSignals(data);
      }
      setIsLoading(false);
    };

    void fetchSignals();

    const channel = sb
      .channel('radar-signals-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'radar_signals' },
        (payload) => {
          const newSignal = payload.new as RadarSignal;
          setSignals((prev) => [newSignal, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'radar_signals' },
        (payload) => {
          const updated = payload.new as RadarSignal;
          setSignals((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const filteredSignals = useMemo(() => {
    if (filter === 'ALL') return signals;
    return signals.filter((s) => s.signal_type.toUpperCase() === filter);
  }, [signals, filter]);

  const categories: FilterType[] = ['ALL', 'IN-PLAY', 'NEXT GOAL', 'HANDICAP'];

  return (
    <div className="pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans min-h-screen">
      <Header onBalanceClick={onBalanceClick} hideBalance={hideBalance} />

      {/* Title & Status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-neon-gold text-xs font-bold tracking-widest uppercase">
          <Zap size={14} fill="currentColor" className="animate-pulse" />
          Quant Signal Feed
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neon-green/10 border border-neon-green/20">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-ping" />
          <span className="text-[10px] text-neon-green font-mono font-bold uppercase">Live Scanning</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all border ${
              filter === cat
                ? 'bg-neon-gold text-black border-neon-gold shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                : 'bg-surface border-white/5 text-gray-500 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Signals List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-neon-gold border-t-transparent rounded-full animate-spin" />
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Synchronizing Radar...</div>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="text-center py-20 px-10 bg-surface/30 rounded-2xl border border-white/5">
            <Search className="w-10 h-10 text-gray-600 mx-auto mb-4 opacity-50" />
            <div className="text-sm text-gray-500 font-medium">No active signals found.</div>
            <div className="text-[10px] text-gray-600 mt-2 font-mono uppercase tracking-widest">Scanning market liquidity...</div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredSignals.map((signal) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`premium-card relative group cursor-pointer overflow-hidden ${
                  signal.status === 'won' ? 'bg-neon-green/5 border-neon-green/30' : ''
                }`}
                onClick={() => setSelectedSignal(signal)}
              >
                {/* Won Overlay */}
                {signal.status === 'won' && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-neon-green text-black text-[10px] font-black uppercase tracking-widest rounded-bl-xl z-10 shadow-lg shadow-neon-green/20">
                    WON
                  </div>
                )}

                <div className="premium-card-content !p-4">
                  {/* Top Info */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono truncate mb-1">
                        {signal.league_name}
                      </div>
                      <div className="flex items-center gap-1.5 text-neon-green font-mono font-bold text-xs">
                        <Activity size={12} className="animate-pulse" />
                        <span>{signal.clock}'</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Live Odds</div>
                      <div className="text-2xl font-black text-neon-gold font-data leading-none group-hover:scale-110 transition-transform origin-right">
                        @{signal.odds.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Match & Prediction */}
                  <div className="mb-4">
                    <div className="text-sm font-bold text-gray-300 mb-2 truncate">
                      {signal.home_name} <span className="text-gray-600 mx-1">vs</span> {signal.away_name}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-2 bg-black/40 border border-white/5 rounded-xl flex-1 group-hover:border-neon-gold/20 transition-colors">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Prediction</div>
                        <div className="text-sm font-black text-white italic tracking-tight">
                          {signal.prediction}
                        </div>
                      </div>
                      <button className="p-3 bg-white/5 rounded-xl text-gray-400 group-hover:text-neon-gold transition-colors">
                        <Info size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Confidence Index</span>
                      <span className="text-[10px] text-white font-mono font-bold">{signal.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${signal.confidence}%` }}
                        className={`h-full rounded-full ${
                          signal.confidence > 80 ? 'bg-neon-green shadow-[0_0_8px_rgba(74,222,128,0.5)]' :
                          signal.confidence > 60 ? 'bg-neon-gold shadow-[0_0_8px_rgba(255,215,0,0.5)]' :
                          'bg-orange-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Signal Detail Modal */}
      <AnimatePresence>
        {selectedSignal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSignal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">
                      {selectedSignal.league_name}
                    </div>
                    <h3 className="text-xl font-black text-white leading-tight">
                      {selectedSignal.home_name}<br />
                      <span className="text-neon-gold">vs</span><br />
                      {selectedSignal.away_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedSignal(null)}
                    className="p-2 bg-white/5 rounded-xl text-gray-500 hover:text-white transition"
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 px-4 py-3 bg-black/40 rounded-2xl border border-neon-gold/20">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Quant Prediction</div>
                    <div className="text-lg font-black text-white italic tracking-tighter">
                      {selectedSignal.prediction}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Odds</div>
                    <div className="text-3xl font-black text-neon-gold font-data leading-none">
                      @{selectedSignal.odds.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Content - Chart Area */}
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-neon-green text-[10px] font-bold tracking-widest uppercase mb-4">
                    <TrendingUp size={14} />
                    Live Pressure Trend
                  </div>
                  <div className="h-48 w-full bg-black/40 rounded-2xl border border-white/5 p-4 relative">
                    {/* Re-use OddsChart component for visualization */}
                    <OddsChart />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Volume 24h</div>
                    <div className="text-lg font-black text-white font-mono">$1.2M</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Volatility</div>
                    <div className="text-lg font-black text-neon-red font-mono">HIGH</div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSignal(null)}
                  className="w-full py-4 bg-neon-gold text-black font-black uppercase tracking-widest rounded-2xl hover:brightness-110 transition shadow-lg shadow-neon-gold/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Zap size={18} fill="currentColor" />
                  FOLLOW SIGNAL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
