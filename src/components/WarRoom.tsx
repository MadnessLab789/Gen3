import { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, TrendingUp, Users, X, CheckCircle, Info, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import OddsChart from './OddsChart';
import CopyTrade from './CopyTrade';
import TraderProfile from './TraderProfile';
import ChatRoom from './ChatRoom';

interface Analysis {
  signal: string;
  odds: number;
  confidence: number;
  guruComment?: string;
}

interface Match {
  id: number;
  league: string;
  home: string;
  away: string;
  time: string;
  status: 'LIVE' | 'PRE_MATCH';
  score?: string;
  isStarred: boolean;
  tags: string[];
  tagColor?: string;
  analysis: Analysis;
  chartData: any[];
}

interface WarRoomProps {
  match: Match;
  onClose: () => void;
  onUpdateBalance?: (amount: number) => void;
  onVipPurchase?: () => void | Promise<void>;
  isVip?: boolean;
  chatUserId?: number | null;
  chatUsername?: string | null;
  userBalance?: number;
}

type TabType = 'signals' | 'chat' | 'copyTrade';

type SignalType = 'sniper' | 'analysis';

interface SignalItem {
  id: number;
  type: SignalType;
  category: '1x2' | 'hdp' | 'ou';
  league: string;
  time: string;
  status: string;
  timestamp: string;
  title: string;
  market?: string;
  odds?: number;
  unit?: string;
  statusText?: string;
  strategy?: string;
  suggestion?: string;
  reasoning?: string;
  stats?: string[];
  guruComment?: string;
}

// Import generated signals from CSV data (colleague's Supabase data)
import { MOCK_SIGNALS as GENERATED_SIGNALS } from '../data/generatedSignals';

// PRE_MATCH signals: Only SNIPER ACTION (1X2) for matches that haven't started
// These are used when match.status === 'PRE_MATCH'
const PRE_MATCH_SIGNALS: SignalItem[] = (GENERATED_SIGNALS as SignalItem[])
  .filter(s => s.type === 'sniper' && s.category === '1x2')
  .map(s => ({
    ...s,
    status: 'PRE_MATCH', // Override status for PRE_MATCH display
    time: s.time.replace('LIVE ', '').trim(), // Remove LIVE prefix for PRE_MATCH
  }));

// BettingSheet Component
interface BettingSheetProps {
  match: Match;
  betAmount: number;
  onBetAmountChange: (amount: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  userBalance: number;
}

function BettingSheet({
  match,
  betAmount,
  onBetAmountChange,
  onConfirm,
  onClose,
  userBalance,
}: BettingSheetProps) {
  const balance = Number.isFinite(userBalance) ? Math.max(userBalance, 0) : 0;
  const quickAmounts = [10, 50, 100];
  const estimatedReturn = Math.round(betAmount * match.analysis.odds);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface/98 backdrop-blur-xl border-t-2 border-neon-gold/50 rounded-t-2xl shadow-2xl z-60"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-neon-gold">Place Your Bet</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Odds Display */}
        <div className="bg-black/40 rounded-lg p-4 border border-neon-gold/30 mb-6">
          <div className="text-sm text-gray-400 mb-1">Betting On</div>
          <div className="text-3xl font-black text-white font-mono">
            {match.analysis.signal} @ {match.analysis.odds}
          </div>
        </div>

        {/* Amount Selector */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 mb-3">Bet Amount</div>
          
          {/* Quick Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => onBetAmountChange(amount)}
                className={`py-2 px-4 rounded-lg font-bold transition-all ${
                  betAmount === amount
                    ? 'bg-neon-gold text-black'
                    : 'bg-white/5 text-white border border-white/10 hover:border-neon-gold/50'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>

          {/* All-in Button */}
          <button
            onClick={() => onBetAmountChange(balance)}
            className={`w-full py-2 px-4 rounded-lg font-bold transition-all ${
              betAmount === balance
                ? 'bg-neon-gold text-black'
                : 'bg-white/5 text-white border border-white/10 hover:border-neon-gold/50'
            }`}
          >
            All-in (${balance})
          </button>

          {/* Custom Amount Input */}
          <input
            type="number"
            min="1"
            max={balance}
            value={betAmount || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onBetAmountChange(Math.min(value, balance));
            }}
            placeholder="Enter custom amount"
            className="w-full mt-3 bg-surface-highlight border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-gold/50 font-mono"
          />
        </div>

        {/* Estimated Return */}
        <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-400 mb-1">Est. Return</div>
          <div className="text-2xl font-black text-neon-green font-mono">
            ${estimatedReturn}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Profit: ${estimatedReturn - betAmount}
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={onConfirm}
          disabled={betAmount <= 0 || betAmount > balance}
          className={`w-full py-4 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-lg rounded-lg transition-all ${
            betAmount <= 0 || betAmount > balance
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-lg hover:shadow-neon-gold/50'
          }`}
        >
          CONFIRM (${betAmount})
        </button>
      </div>
    </motion.div>
  );
}

export default function WarRoom({
  match,
  onClose,
  onUpdateBalance,
  onVipPurchase,
  isVip = false,
  chatUserId = null,
  chatUsername = null,
  userBalance = 0,
}: WarRoomProps) {
  const [activeTab, setActiveTab] = useState<TabType>('signals');
  const [showBettingSlip, setShowBettingSlip] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SignalItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | '1x2' | 'hdp' | 'ou'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [readCategories, setReadCategories] = useState<Set<string>>(new Set());
  const [settlementResult, setSettlementResult] = useState<'WON' | 'LOST' | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedTrader, setSelectedTrader] = useState<any | null>(null);

  const tabs = [
    { id: 'signals' as TabType, label: 'Signals', icon: TrendingUp },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'copyTrade' as TabType, label: 'Copy Trade', icon: Users },
  ];

  // Auto-hide success message
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Auto-hide settlement modal
  useEffect(() => {
    if (settlementResult) {
      const timer = setTimeout(() => {
        setSettlementResult(null);
        setWinAmount(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [settlementResult]);

  // Auto-hide toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 模拟新消息：5s 后让 ou 再次变为未读（红点）
  useEffect(() => {
    const timer = setTimeout(() => {
      setReadCategories((prev) => {
        const next = new Set(prev);
        next.delete('ou'); // remove read state so red dot reappears
        return next;
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handlePlaceBet = () => {
    setShowBettingSlip(true);
    setBetAmount(0);
  };

  const handleConfirmBet = () => {
    const currentBetAmount = betAmount; // Save bet amount before resetting
    setShowBettingSlip(false);
    setBetAmount(0);

    // Simulate settlement after 5 seconds
    setTimeout(() => {
      const isWin = Math.random() < 0.7; // 70% win rate
      
      if (isWin) {
        const odds = match.analysis.odds;
        const calculatedWin = Math.round((currentBetAmount * odds - currentBetAmount) * 100) / 100;
        setWinAmount(calculatedWin);
        setSettlementResult('WON');
        
        // Update balance in parent
        if (onUpdateBalance) {
          onUpdateBalance(calculatedWin);
        }
      } else {
        setSettlementResult('LOST');
      }
    }, 5000);
  };

  const generateShareText = (signal: any) => {
    const isSniper = signal.type === 'sniper';
    const icon = isSniper ? '🚨' : '🧠';
    const title = isSniper ? 'SNIPER ACTION' : 'FULL ANALYSIS';

    return `
➖➖➖➖➖➖➖➖➖➖
${icon} 𝗢𝗗𝗗𝗦𝗙𝗟𝗢𝗪 ${title}
➖➖➖➖➖➖➖➖➖➖

🏆 ${signal.league || 'Premium League'}
⚽️ ${signal.title || signal.match || 'Match Info'}
⏱️ 𝗧𝗜𝗠𝗘: ${signal.timestamp || 'LIVE'}

🎯 𝗦𝗜𝗚𝗡𝗔𝗟: ${signal.market || signal.suggestion}
💰 𝗢𝗗𝗗𝗦:  @ ${signal.odds || 'Wait'}
📦 𝗨𝗡𝗜𝗧:  +1 (Holding)

📝 𝗚𝗨𝗥𝗨 𝗡𝗢𝗧𝗘:
"${signal.guruComment || signal.guruText || 'System detected value gap.'}"

➖➖➖➖➖➖➖➖➖➖
🚀 𝖠𝗇𝖺𝗅𝗒𝗓𝖾𝖽 𝖻𝗒 𝗢𝗱𝗱𝘀𝗙𝗹𝗼𝘄 𝗔𝗜
🔗 𝖩𝗈𝗂𝗇 𝖵𝖨𝖯: oddsflow.ai/vip
➖➖➖➖➖➖➖➖➖➖
    `.trim();
  };

  const handleCopy = async (signal: SignalItem) => {
    const text = generateShareText(signal);

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedId(signal.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (e) {
      // silent fail
    }
  };

  const handleUnlockVip = () => {
    if (onVipPurchase) {
      void onVipPurchase();
      return;
    }
    setToastMessage('VIP 支付功能即将上线！');
  };

  // const handleGoToChannel = () => {
  //   try {
  //     window.open(VIP_CHANNEL_URL, '_blank');
  //   } catch {
  //     // ignore
  //   }
  // };

  // --- Sniper Ticket Card ---
  const SniperTicket = ({ signal }: { signal: SignalItem }) => (
    <div className="bg-surface-highlight border border-neon-gold/50 rounded-xl overflow-hidden shadow-[0_0_24px_rgba(255,194,0,0.12)]">
      {/* Red Banner */}
      <div className="bg-neon-red/10 text-neon-red border-b border-neon-red/20 px-4 py-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>🚨</span>
          <span>SNIPER ACTION</span>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="font-semibold">{signal.league}</span>
            <span className="px-2 py-1 rounded-full text-[10px] bg-neon-red/10 text-neon-red font-mono">⏱️ {signal.timestamp}</span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>⚽️ {signal.title}</span>
            <button
              onClick={() => handleCopy(signal)}
              className="text-gray-400 hover:text-neon-gold transition-colors"
              aria-label="Share"
            >
              {copiedId === signal.id ? <Check className="w-4 h-4 text-neon-gold" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

      <div className="flex items-center justify-between bg-black/30 rounded-lg p-4 border border-white/5">
        <div className="text-left">
          <div className="text-xs text-gray-400 mb-1">Market</div>
          <div className="text-3xl font-black text-white tracking-tight">
            {signal.market}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-1">Odds</div>
          <div className="text-3xl font-black text-neon-gold font-mono">@ {signal.odds?.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-300 font-mono">
        <span>Unit: {signal.unit}</span>
        <span>Status: {signal.statusText}</span>
      </div>

        {/* TODO: Enable this button when Auto-Betting feature is ready */}
        {false && (
        <button
          onClick={handlePlaceBet}
          className="w-full mt-2 py-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-bold text-sm rounded-lg hover:shadow-lg hover:shadow-neon-gold/40 transition-all"
        >
          Follow Bet
        </button>
        )}
      </div>
    </div>
  );

  // --- Analysis Card ---
  const AnalysisCard = ({ signal }: { signal: SignalItem }) => (
    <div className="bg-surface border border-white/10 rounded-xl overflow-hidden shadow-neon-green/10 shadow-lg">
      {/* Blue/Purple Banner */}
      <div className="bg-neon-blue/10 text-neon-blue border-b border-neon-blue/20 px-4 py-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>🧠</span>
          <span>FULL ANALYSIS</span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div>
              <div className="font-semibold">{signal.title}</div>
              <div className="text-[10px] text-gray-500">{signal.league} • {signal.time}</div>
            </div>
            <span className="px-2 py-1 rounded-full text-[10px] bg-neon-red/10 text-neon-red font-mono">⏱️ {signal.timestamp}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(signal)}
              className="text-gray-400 hover:text-neon-gold transition-colors"
              aria-label="Share"
            >
              {copiedId === signal.id ? <Check className="w-4 h-4 text-neon-gold" /> : <Share2 className="w-4 h-4" />}
            </button>
            <span className="px-2 py-1 text-[10px] rounded-full bg-neon-green/10 text-neon-green border border-neon-green/30">v5.1 Optimized</span>
          </div>
        </div>

        {!isVip ? (
          <div className="bg-black/40 border border-white/10 rounded-lg p-4">
            <div className="text-sm font-bold text-white mb-2">Unlock Full Analysis</div>
            <div className="text-xs text-gray-400 mb-4">
              Upgrade to VIP to view strategy, reasoning, and AI guru notes.
            </div>
            <button
              onClick={handleUnlockVip}
              className="w-full py-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm rounded-lg hover:shadow-lg hover:shadow-neon-gold/40 transition-all"
            >
              Unlock Full Analysis
            </button>
            <div className="text-[11px] text-gray-400 mt-2 text-center">
              Unlock with 100 Stars • Upgrade to VIP
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Strategy</div>
                  <div className="text-lg font-bold text-neon-green">{signal.strategy}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedAnalysis(signal);
                    setShowAnalysisDetail(true);
                  }}
                  className="text-neon-blue hover:text-white transition-colors animate-pulse"
                  aria-label="View detailed analysis"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-1">Suggestion</div>
                <div className="flex items-center justify-end text-lg font-bold text-white">
                  <span>{signal.suggestion}</span>
                  <Info
                    onClick={() => {
                      setSelectedAnalysis(signal);
                      setShowAnalysisDetail(true);
                    }}
                    className="w-4 h-4 text-neon-blue ml-2 cursor-pointer animate-pulse"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-black/40 border border-white/10 rounded-lg p-3">
              <div className="w-10 h-10 rounded-full bg-neon-purple/30 flex items-center justify-center text-xl">🧔</div>
              <p className="text-sm text-gray-200 leading-relaxed">
                {signal.guruComment}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.open('https://t.me/oddsflowvip', '_blank')}
                className="w-full py-2 bg-white/5 text-white font-bold text-sm rounded-lg border border-white/10 hover:border-neon-blue/50 hover:bg-white/10 transition-all"
              >
                Go to Channel for Discussion
              </button>
              {/* TODO: Enable this button when Auto-Betting feature is ready */}
              {false && (
              <button
                onClick={handlePlaceBet}
                className="w-full py-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-bold text-sm rounded-lg hover:shadow-lg hover:shadow-neon-gold/40 transition-all"
              >
                Follow Bet
              </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // --- Analysis Modal ---
  const AnalysisModal = ({ signal, onClose }: { signal: SignalItem; onClose: () => void }) => (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="fixed inset-0 z-[101] flex items-center justify-center px-4"
      >
        <div className="max-w-xl w-full bg-surface border-2 border-neon-gold/50 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-lg font-black text-neon-gold flex items-center gap-2">🧠 DEEP DIVE ANALYSIS</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-sm text-gray-200 leading-relaxed">
            <div>
              <div className="text-neon-gold font-semibold mb-2">💡 核心理由 (Reasoning)</div>
              <p>{signal.reasoning}</p>
            </div>

            <div>
              <div className="text-neon-gold font-semibold mb-2">📈 庄家数据 (Bookmaker Data)</div>
              <ul className="space-y-1 list-disc list-inside text-gray-300">
                {(signal.stats || []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black rounded-lg hover:shadow-lg hover:shadow-neon-gold/50 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );

  // State for LIVE signals from Supabase
  const [liveSignals, setLiveSignals] = useState<SignalItem[]>([]);

  // Fetch LIVE signals from Supabase when match is LIVE
  useEffect(() => {
    if (match.status !== 'LIVE' || !supabase) {
      setLiveSignals([]);
      return;
    }

    const sb = supabase; // Store in local variable for null safety

    // Fetch signals from David's Supabase tables
    const fetchLiveSignals = async () => {
      if (!sb) return;
      
      try {
        // Fetch from handicap, over_under, and moneyline tables
        const [handicapRes, overUnderRes, moneylineRes] = await Promise.all([
          sb
            .from('handicap')
            .select('*')
            .eq('fixture_id', match.id)
            .order('created_at', { ascending: false })
            .limit(10),
          sb
            .from('over_under')
            .select('*')
            .eq('fixture_id', match.id)
            .order('created_at', { ascending: false })
            .limit(10),
          sb
            .from('moneyline')
            .select('*')
            .eq('fixture_id', match.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        const signals: SignalItem[] = [];

        // Transform handicap signals
        if (handicapRes.data) {
          handicapRes.data.forEach((h: any) => {
            if (h.signal && !h.signal.includes('观望')) {
              signals.push({
                id: signals.length + 1,
                type: 'analysis',
                category: 'hdp',
                league: h.league_name || match.league,
                time: h.clock ? `LIVE ${h.clock}'` : 'LIVE',
                status: 'LIVE',
                timestamp: h.clock ? `${h.clock}'` : '0\'',
                title: `${h.home_name} vs ${h.away_name}`,
                strategy: h.signal,
                suggestion: h.selection || `Line ${h.line}`,
                reasoning: h.market_analysis_trend_direction || h.stacking_plan_description || '',
                stats: [
                  `趋势: ${h.market_analysis_trend_direction || 'N/A'}`,
                  `变盘: ${h.market_analysis_odds_check || 'N/A'}`,
                  `抽水: ${h.market_analysis_vig_status || 'N/A'}`
                ],
                guruComment: h.commentary_malaysia || h.stacking_plan_description || ''
              });
            }
          });
        }

        // Transform over/under signals
        if (overUnderRes.data) {
          overUnderRes.data.forEach((ou: any) => {
            if (ou.signal && !ou.signal.includes('观望')) {
              signals.push({
                id: signals.length + 1,
                type: 'analysis',
                category: 'ou',
                league: ou.league_name || match.league,
                time: ou.clock ? `LIVE ${ou.clock}'` : 'LIVE',
                status: 'LIVE',
                timestamp: ou.clock ? `${ou.clock}'` : '0\'',
                title: `${ou.home_name} vs ${ou.away_name}`,
                strategy: ou.signal,
                suggestion: `Over ${ou.line}`,
                reasoning: ou.market_analysis_trend_direction || ou.stacking_plan_description || '',
                stats: [
                  `趋势: ${ou.market_analysis_trend_direction || 'N/A'}`,
                  `变盘: ${ou.market_analysis_odds_check || 'N/A'}`,
                  `抽水: ${ou.market_analysis_vig_status || 'N/A'}`
                ],
                guruComment: ou.commentary_malaysia || ou.stacking_plan_description || ''
              });
            }
          });
        }

        // Transform moneyline signals
        if (moneylineRes.data) {
          moneylineRes.data.forEach((m: any) => {
            if (m.signal && !m.signal.includes('观望')) {
              signals.push({
                id: signals.length + 1,
                type: 'sniper',
                category: '1x2',
                league: m.league_name || match.league,
                time: m.clock ? `LIVE ${m.clock}'` : 'LIVE',
                status: 'LIVE',
                timestamp: m.clock ? `${m.clock}'` : '0\'',
                title: `${m.home_name} vs ${m.away_name}`,
                market: m.selection || 'Home Win',
                odds: parseFloat(m.moneyline_1x2_home || m.moneyline_1x2_away || 2.0),
                unit: '+1',
                statusText: 'Active 🎯'
              });
            }
          });
        }

        setLiveSignals(signals);
      } catch (error) {
        console.error('Error fetching live signals:', error);
      }
    };

    void fetchLiveSignals();

    // Set up realtime subscription for LIVE signals
    if (!sb) return;
    
    const channels = [
      sb
        .channel(`handicap-${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'handicap',
          filter: `fixture_id=eq.${match.id}`,
        }, () => {
          void fetchLiveSignals();
        })
        .subscribe(),
      sb
        .channel(`over_under-${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'over_under',
          filter: `fixture_id=eq.${match.id}`,
        }, () => {
          void fetchLiveSignals();
        })
        .subscribe(),
      sb
        .channel(`moneyline-${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'moneyline',
          filter: `fixture_id=eq.${match.id}`,
        }, () => {
          void fetchLiveSignals();
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(ch => sb.removeChannel(ch));
    };
  }, [match.status, match.id, match.league]);

  // Determine which signals to display based on match status
  const availableSignals = match.status === 'LIVE' 
    ? liveSignals  // LIVE: Use signals from Supabase (HDP, O/U, 1X2) - real-time from David's Supabase
    : PRE_MATCH_SIGNALS; // PRE_MATCH: Only show SNIPER ACTION (1X2) - no analysis until match starts

  // Filter and order signals: Sniper first, then Analysis
  const filteredSignals = availableSignals.filter(
    (s) => filterCategory === 'all' || s.category === filterCategory
  );
  const orderedSignals = [
    ...filteredSignals.filter((s) => s.type === 'sniper'),
    ...filteredSignals.filter((s) => s.type === 'analysis'),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="min-h-screen max-w-md mx-auto px-4 pt-6 pb-24">
        {/* Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-md"
            >
              <div className="rounded-xl border border-neon-gold/30 bg-surface/90 backdrop-blur-md px-4 py-3 shadow-[0_0_30px_rgba(255,194,0,0.15)]">
                <div className="text-sm font-bold text-neon-gold">{toastMessage}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="flex items-center gap-4 mb-6">
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <div className="text-xs text-gray-400 font-mono">{match.league}</div>
            <h2 className="text-lg font-bold">
              {match.home} <span className="text-gray-500">vs</span> {match.away}
            </h2>
            {match.status === 'LIVE' && (
              <span className="text-neon-red font-mono text-xs animate-pulse">
                ● LIVE {match.score}
              </span>
            )}
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-b-2 transition-colors ${
                  isActive
                    ? 'border-neon-gold text-neon-gold'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'signals' && (
            <motion.div
              key="signals"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6 pb-28"
            >
              {/* Category Filters */}
              <div className="flex gap-2">
                {[
                  { id: 'all', label: 'ALL' },
                  { id: 'hdp', label: 'HDP' },
                  { id: 'ou', label: 'O/U' },
                  { id: '1x2', label: '1X2' },
                ].map((cat) => {
                  const isActive = filterCategory === cat.id;
                  const isUnread = cat.id !== 'all' && !readCategories.has(cat.id);
                  const showDot = cat.id !== 'all';
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setFilterCategory(cat.id as any);
                        if (cat.id !== 'all') {
                          setReadCategories((prev) => {
                            const next = new Set(prev);
                            next.add(cat.id); // mark as read
                            return next;
                          });
                        }
                      }}
                      className={`relative px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        isActive
                          ? 'bg-neon-gold text-black shadow-[0_0_16px_rgba(255,194,0,0.35)]'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                      {showDot && (
                        <span
                          className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                            isUnread ? 'bg-neon-red' : 'bg-gray-600'
                          }`}
                        ></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Signals List (Sniper first, then Analysis) */}
              <div className="space-y-4">
                {orderedSignals.map((signal) =>
                  signal.type === 'sniper' ? (
                    <SniperTicket key={signal.id} signal={signal} />
                  ) : (
                    <AnalysisCard key={signal.id} signal={signal} />
                  )
                )}
              </div>

              {/* Smart Money Chart (bottom) */}
              <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-neon-green">
                    <TrendingUp size={18} fill="currentColor" />
                    <span className="font-bold font-mono tracking-wider">SMART MONEY FLOW</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-white leading-none">
                      LIVE ODDS TREND
                    </div>
                    <div className="text-sm text-neon-red font-mono animate-pulse">● LIVE</div>
                  </div>
                </div>

                <OddsChart />

                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500">Confidence</span>
                  <span className="text-lg font-bold text-neon-green font-mono">
                    {match.analysis.confidence}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-neon-gold text-xs font-semibold uppercase tracking-wide">
                <span className="text-sm">🔒 VIP Insider Access</span>
              </div>
              
              {/* Strict Gating: 只有当 signal 存在且不为空字符串时才渲染 ChatRoom */}
              {match.analysis.signal && match.analysis.signal.trim().length > 0 ? (
                chatUserId && chatUsername ? (
              <ChatRoom
                    matchId={match.id}
                    currentUser={{ id: chatUserId, username: chatUsername }}
                onBack={() => setActiveTab('signals')}
              />
                ) : (
                  <div className="text-sm text-gray-400 p-4">
                    Chat is not available. Please ensure you are logged in.
                  </div>
                )
              ) : (
                /* Placeholder: 雷达扫描动画模块 */
                <div className="relative h-[500px] rounded-xl overflow-hidden border border-green-500/20 bg-gradient-to-br from-green-900/10 to-emerald-900/10">
                  {/* 绿色网格背景 */}
                  <div 
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
                      `,
                      backgroundSize: '20px 20px'
                    }}
                  />
                  
                  {/* 雷达扫描动画 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      {/* 雷达圆环 */}
                      <div className="absolute inset-0 rounded-full border border-green-500/30" />
                      <div className="absolute inset-[25%] rounded-full border border-green-500/20" />
                      <div className="absolute inset-[50%] rounded-full border border-green-500/10" />
                      
                      {/* 扫描线 */}
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34, 197, 94, 0.3) 60deg, transparent 120deg)',
                        }}
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                      
                      {/* 中心点 */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                      
                      {/* 扫描点动画 */}
                      {[0, 1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-400"
                          style={{
                            originX: 0.5,
                            originY: 0.5,
                          }}
                          animate={{
                            x: [
                              Math.cos((i * 90) * (Math.PI / 180)) * 100,
                              Math.cos((i * 90) * (Math.PI / 180)) * 120,
                              Math.cos((i * 90) * (Math.PI / 180)) * 100,
                            ],
                            y: [
                              Math.sin((i * 90) * (Math.PI / 180)) * 100,
                              Math.sin((i * 90) * (Math.PI / 180)) * 120,
                              Math.sin((i * 90) * (Math.PI / 180)) * 100,
                            ],
                            opacity: [0.3, 0.8, 0.3],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* 文案 */}
                  <div className="absolute bottom-8 left-0 right-0 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-2"
                    >
                      <p className="text-green-400 font-mono text-sm font-semibold tracking-wider">
                        Analyzing Market Depth...
                      </p>
                      <p className="text-green-500/70 font-mono text-xs tracking-wide">
                        Waiting for Sniper Signal.
                      </p>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'copyTrade' && (
            <motion.div
              key="copyTrade"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {selectedTrader ? (
                <TraderProfile trader={selectedTrader} onClose={() => setSelectedTrader(null)} />
              ) : (
                <CopyTrade userId={chatUserId} onSelectTrader={(trader) => setSelectedTrader(trader)} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BettingSheet Modal */}
      <AnimatePresence>
        {showBettingSlip && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBettingSlip(false)}
              className="fixed inset-0 bg-black/50 z-55"
            />
            {/* Sheet */}
            <BettingSheet
              match={match}
              betAmount={betAmount}
              onBetAmountChange={setBetAmount}
              onConfirm={handleConfirmBet}
              onClose={() => setShowBettingSlip(false)}
              userBalance={userBalance}
            />
          </>
        )}
      </AnimatePresence>

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mb-6"
              >
                <CheckCircle className="w-24 h-24 text-neon-green mx-auto" fill="currentColor" />
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black text-neon-green mb-2"
              >
                Bet Placed Successfully!
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-gray-300"
              >
                Good luck! 🍀
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Detail Modal */}
      <AnimatePresence>
        {showAnalysisDetail && selectedAnalysis && isVip && (
          <AnalysisModal
            signal={selectedAnalysis}
            onClose={() => setShowAnalysisDetail(false)}
          />
        )}
      </AnimatePresence>

      {/* Settlement Modal */}
      <AnimatePresence>
        {settlementResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="text-center px-6"
            >
              {settlementResult === 'WON' ? (
                <>
                  {/* Gold coins explosion effect */}
                  <div className="relative mb-6">
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        animate={{
                          x: Math.cos((i * Math.PI * 2) / 8) * 60,
                          y: Math.sin((i * Math.PI * 2) / 8) * 60,
                          opacity: 0,
                          scale: 0.3,
                        }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      >
                        <span className="text-2xl">🪙</span>
                      </motion.div>
                    ))}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                      className="text-6xl mb-4"
                    >
                      🎉
                    </motion.div>
                  </div>

                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl font-black text-neon-gold mb-4"
                  >
                    BET WON!
                  </motion.h2>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-4xl font-black text-neon-green font-mono mb-2"
                  >
                    +${winAmount.toFixed(2)}
                  </motion.div>

                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-lg text-gray-300 mt-4"
                  >
                    Congratulations! 🎊
                  </motion.p>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="text-6xl mb-4"
                  >
                    ❌
                  </motion.div>

                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl font-black text-neon-red mb-4"
                  >
                    BET LOST
                  </motion.h2>

                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg text-gray-300 mt-4"
                  >
                    Better luck next time! 💪
                  </motion.p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
