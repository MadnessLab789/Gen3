import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare, TrendingUp, Users, X, CheckCircle, Info, Share2, Check, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { oddsSupabase } from '../supabaseClient';
import CopyTrade from './CopyTrade';
import TraderProfile from './TraderProfile';
import LiveChat from './LiveChat';

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
  // Nuclear render guard: only render if this matches current fixture
  fixture_id?: number;
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
  stacking_quantity?: string;
  stacking_plan_description?: string;
  market_analysis_trend_direction?: string;
  market_analysis_odds_check?: string;
  commentary_malaysia?: string;
  // New fields for history table
  selection?: string;
  line?: string;
  home_odds?: number;
  away_odds?: number;
  draw_odds?: number;
  bookmaker?: string;
  vig_status?: string;
  clock?: string;
  signal?: string;
}

// Nuclear: remove ALL PRE_MATCH mock/seed signals to prevent any hardcoded team names leaking into UI.
// If there is no analysis for a match, we prefer a blank "Waiting for AI Analysis..." state.
const PRE_MATCH_SIGNALS: SignalItem[] = [];

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
  // Entry gate: show War Room UI first, load reports only after user confirms.
  const [hasEntered, setHasEntered] = useState(false);
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCategory, setHistoryCategory] = useState<'1x2' | 'hdp' | 'ou'>('hdp');
  const [historicalData, setHistoryData] = useState<Record<'1x2' | 'hdp' | 'ou', any[]>>({
    '1x2': [],
    hdp: [],
    ou: [],
  });

  // Signal History Modal Component
  const SignalHistoryModal = ({ 
    category, 
    data, 
    onClose 
  }: { 
    category: string; 
    data: any[]; 
    onClose: () => void 
  }) => (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 z-[111] bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl shadow-2xl h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h3 className="text-xl font-black text-white">Signal History - {category.toUpperCase()}</h3>
            <p className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest uppercase">Verified Quantitative Logs</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-black/20">
          <table className="w-full text-left border-collapse min-w-[800px] font-sans">
            <thead className="sticky top-0 bg-[#0A0A0A] z-10">
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Clock</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Signal</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Selection</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Line</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Odds (H/D/A)</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Bookmaker</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest border-r border-white/5">Staking</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Vig Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((item, idx) => {
                const signal = item.signal || '-';
                const isWait = signal.toLowerCase().includes('wait');
                const isHold = signal.toLowerCase().includes('hold');
                const isStrong = signal.toLowerCase().includes('strong') || signal.toLowerCase().includes('back') || signal.toLowerCase().includes('recovery');
                
                return (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-500 group-hover:text-white border-r border-white/5">{item.clock || '0'}'</td>
                    <td className="px-4 py-3 border-r border-white/5">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                        isStrong ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                        isHold ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        isWait ? 'bg-neon-gold/10 text-neon-gold border-neon-gold/20' :
                        'bg-gray-500/10 text-gray-500 border-white/5'
                      }`}>
                        {signal}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white font-bold border-r border-white/5">{item.selection || item.market || '-'}</td>
                    <td className="px-4 py-3 text-[11px] font-mono text-neon-blue font-black border-r border-white/5">{item.line || '-'}</td>
                    
                    <td className="px-4 py-3 text-[11px] font-mono text-gray-400 border-r border-white/5">
                      <div className="flex gap-2">
                        <span className="text-white">{category === 'ou' ? item.over : (item.home_odds || item.moneyline_1x2_home || '-')}</span>
                        {category === '1x2' && <span className="text-gray-600">/</span>}
                        {category === '1x2' && <span className="text-white">{item.moneyline_1x2_draw || '-'}</span>}
                        <span className="text-gray-600">/</span>
                        <span className="text-white">{category === 'ou' ? item.under : (category === '1x2' ? item.moneyline_1x2_away : (item.away_odds || '-'))}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[9px] text-gray-500 font-mono uppercase border-r border-white/5">{item.bookmaker || 'bet365'}</td>
                    <td className="px-4 py-3 border-r border-white/5">
                      <div className="text-[10px] font-black text-neon-gold tracking-tight">{item.stacking_quantity || '0 Unit'}</div>
                      <div className="text-[8px] text-gray-600 italic truncate max-w-[120px]">{item.stacking_plan_description || 'Observe'}</div>
                    </td>
                    <td className="px-4 py-3 text-[9px] font-mono text-gray-500">{item.vig_status || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="py-20 text-center text-gray-500">
              <div className="text-4xl mb-4 opacity-20">🗄️</div>
              <p className="text-sm italic">No historical logs available for this fixture yet.</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );

  // Reset entry gate whenever switching to a different match
  useEffect(() => {
    setHasEntered(false);
    setActiveTab('signals');
  }, [match.id]);
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

      {/* NEW: Staking Plan Section */}
      {(signal.stacking_quantity || signal.stacking_plan_description) && (
        <div className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
            <Users size={12} className="text-neon-gold" />
            Staking Plan
          </div>
          <div className="text-xs font-bold text-neon-gold">
            {signal.stacking_quantity || '1.0 Unit'} ({signal.stacking_plan_description || 'Holding'})
          </div>
        </div>
      )}

      {/* NEW: Market Performance Section */}
      {(signal.market_analysis_trend_direction || signal.market_analysis_odds_check) && (
        <div className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
            <Activity size={12} className="text-neon-blue" />
            Market Performance
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed italic">
            {signal.market_analysis_trend_direction}
          </p>
          {signal.market_analysis_odds_check && (
            <p className="text-[11px] text-gray-400 leading-relaxed border-t border-white/5 pt-2">
              {signal.market_analysis_odds_check}
            </p>
          )}
        </div>
      )}

      {/* NEW: Insider Commentary */}
      {signal.commentary_malaysia && (
        <div className="bg-neon-blue/5 border border-neon-blue/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-[10px] text-neon-blue font-bold uppercase mb-1">
            <MessageSquare size={12} />
            Insider Note
          </div>
          <p className="text-[11px] text-gray-200 leading-relaxed">
            {signal.commentary_malaysia}
          </p>
        </div>
      )}

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
              <div className="flex-1">
                <p className="text-sm text-gray-200 leading-relaxed mb-2">
                {signal.guruComment}
              </p>
                {signal.commentary_malaysia && (
                  <div className="text-[11px] text-neon-blue border-t border-white/5 pt-2 italic">
                    MY: {signal.commentary_malaysia}
                  </div>
                )}
              </div>
            </div>

            {/* NEW: Stats Grid for Analysis Card */}
            <div className="grid grid-cols-2 gap-3">
              {(signal.stacking_quantity || signal.stacking_plan_description) && (
                <div className="bg-black/20 border border-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Staking</div>
                  <div className="text-[11px] text-neon-gold font-bold truncate">
                    {signal.stacking_quantity} / {signal.stacking_plan_description}
                  </div>
                </div>
              )}
              {signal.market_analysis_trend_direction && (
                <div className="bg-black/20 border border-white/5 rounded-lg p-2">
                  <div className="text-[9px] text-gray-500 uppercase mb-1">Trend</div>
                  <div className="text-[11px] text-white truncate">
                    {signal.market_analysis_trend_direction}
                  </div>
                </div>
              )}
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

          <div className="p-5 space-y-5 text-sm text-gray-200 leading-relaxed max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* 1. Staking & Strategy */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-neon-gold font-bold uppercase tracking-wider text-xs">
                <Users size={14} />
                Staking & Strategy
              </div>
              <div className="grid grid-cols-2 gap-4">
            <div>
                  <div className="text-[10px] text-gray-500 uppercase">Quantity</div>
                  <div className="text-white font-mono">{signal.stacking_quantity || '0.5 - 1.0 Unit'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Plan</div>
                  <div className="text-neon-green font-bold">{signal.stacking_plan_description || 'Steady Growth'}</div>
                </div>
              </div>
            </div>

            {/* 2. Market Analysis */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-neon-gold font-bold uppercase tracking-wider text-xs">
                <TrendingUp size={14} />
                Market Analysis
              </div>
              <div className="space-y-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">Trend Direction</div>
                  <p className="text-sm text-white leading-relaxed italic">
                    {signal.market_analysis_trend_direction || 'Analyzing market flow and liquidity...'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">Odds Check</div>
                  <p className="text-sm text-white leading-relaxed">
                    {signal.market_analysis_odds_check || 'Monitoring bookmaker risk adjustment...'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. Guru Commentary (Malaysia) */}
            <div className="bg-neon-blue/10 border border-neon-blue/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-neon-blue font-bold uppercase tracking-wider text-xs mb-2">
                <MessageSquare size={14} />
                Insider Commentary (MY)
              </div>
              <p className="text-sm text-gray-200 leading-relaxed font-medium">
                {signal.commentary_malaysia || 'Local market sentiment indicates strong support for this position.'}
              </p>
            </div>

            {/* 4. Original Reasoning & Stats (Hidden if empty) */}
            {signal.reasoning && (
              <div>
                <div className="text-neon-gold font-semibold mb-2 flex items-center gap-2">
                  <Info size={14} /> 核心理由 (Reasoning)
                </div>
                <p className="text-gray-300 text-xs italic">{signal.reasoning}</p>
              </div>
            )}

            {signal.stats && signal.stats.length > 0 && (
            <div>
              <div className="text-neon-gold font-semibold mb-2">📈 庄家数据 (Bookmaker Data)</div>
                <ul className="space-y-1 list-disc list-inside text-gray-300 text-xs">
                  {signal.stats.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            )}
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
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  // Store raw analysis data for potential future use (e.g., detailed analysis view)
  const [_analysisData, setAnalysisData] = useState<{
    hdp: any | null;
    ou: any | null;
    oneXtwo: any | null;
  }>({
    hdp: null,
    ou: null,
    oneXtwo: null,
  });

  // Nuclear: current active fixture id (blocks async/realtime stale updates)
  const activeFixtureIdRef = useRef<number>(Number(match.id));

  // Fetch analysis data from three Supabase tables (HDP, O/U, 1X2)
  // This runs for both LIVE and PRE_MATCH matches
  useEffect(() => {
    const sb = oddsSupabase;
    if (!sb) {
      console.warn('[WarRoom] Odds Supabase client not available');
      return;
    }

    // Entry gate: do not start fetching/subscribing until user confirms entering War Room.
    if (!hasEntered) {
      setLiveSignals([]);
      setAnalysisData({ hdp: null, ou: null, oneXtwo: null });
      setIsLoadingAnalysis(false);
      return;
    }

    // Nuclear: force convert to number (URL params / payloads are often strings)
    const currentFixtureIdFromUrl = Number(match.id);
    const thisRequestFixtureId = currentFixtureIdFromUrl;
    activeFixtureIdRef.current = currentFixtureIdFromUrl;

    // Nuclear: async race prevention — late responses must NOT update state
    let isCancelled = false;

    // CRITICAL: State reset logic - Clear all signals and analysis data BEFORE fetching
    // This ensures UI is in empty state before new data arrives
    setLiveSignals([]);
    setAnalysisData({ hdp: null, ou: null, oneXtwo: null });
    setIsLoadingAnalysis(true);

    // CRITICAL: If fixtureId is undefined or invalid, do NOT make any requests
    if (
      !currentFixtureIdFromUrl ||
      Number.isNaN(currentFixtureIdFromUrl) ||
      currentFixtureIdFromUrl <= 0
    ) {
      console.warn('[WarRoom] Invalid fixtureId, skipping data fetch:', currentFixtureIdFromUrl);
      setIsLoadingAnalysis(false);
      return;
    }

    // Fetch analysis data from three tables concurrently
    const fetchWarRoomAnalysis = async () => {
      setIsLoadingAnalysis(true);
      
      try {
        // Helper function to query table with strict fixture_id filtering
        // CRITICAL: No fallback to limit(1) without fixture_id match
        const queryTable = async (tableName: string, fixtureIdNum: number, limitCount: number = 1) => {
          try {
            // CRITICAL: Ensure fixtureId is a number for Supabase query
            const numericFixtureId = Number(fixtureIdNum);
            if (isNaN(numericFixtureId) || numericFixtureId <= 0) {
              console.warn(`[WarRoom] Invalid numeric fixtureId for ${tableName}:`, fixtureIdNum);
              return { data: null, error: null };
            }

            const result = await sb
              .from(tableName)
              .select('*')
              .or(`fixture_id.eq.${numericFixtureId},id.eq.${numericFixtureId}`) // Try both columns
              .order('created_at', { ascending: false })
              .limit(limitCount);
            
            // CRITICAL: Only return data if fixture_id matches AND component is still mounted
            if (result.data && result.data.length > 0) {
              const validated = result.data.filter(d => Number(d.fixture_id || d.id) === numericFixtureId);
              return { data: limitCount === 1 ? validated[0] : validated, error: null };
            }
            // If fixture_id doesn't match, return null
            return { data: null, error: null };
          } catch (err) {
            console.error(`[WarRoom] Error querying table ${tableName}:`, err);
            return { data: null, error: err };
          }
        };

        // Try multiple table names for O/U and 1X2
        const tryTableQuery = async (tableNames: string[], fixtureId: number, limitCount: number = 1) => {
          for (const tableName of tableNames) {
            const result = await queryTable(tableName, fixtureId, limitCount);
            // If we got valid data with matching fixture_id, return it
            if (result.data) {
              return result;
            }
          }
          // If all failed, return empty result (NO fallback to random data)
          return { data: null, error: null };
        };

        const [hdpResult, ouResult, moneyLineResult, hdpHistory, ouHistory, mlHistory] = await Promise.all([
          // Latest single row for each
          tryTableQuery(['handicap', 'Handicap'], currentFixtureIdFromUrl, 1),
          tryTableQuery(['OverUnder', 'over_under'], currentFixtureIdFromUrl, 1),
          tryTableQuery(['moneyline 1x2', 'money line', 'moneyline'], currentFixtureIdFromUrl, 1),
          // History (last 30 rows)
          tryTableQuery(['handicap', 'Handicap'], currentFixtureIdFromUrl, 30),
          tryTableQuery(['OverUnder', 'over_under'], currentFixtureIdFromUrl, 30),
          tryTableQuery(['moneyline 1x2', 'money line', 'moneyline'], currentFixtureIdFromUrl, 30),
        ]);

        // Update history state
        if (!isCancelled && activeFixtureIdRef.current === thisRequestFixtureId) {
          setHistoryData({
            hdp: Array.isArray(hdpHistory.data) ? hdpHistory.data : [],
            ou: Array.isArray(ouHistory.data) ? ouHistory.data : [],
            '1x2': Array.isArray(mlHistory.data) ? mlHistory.data : [],
          });
        }

        // Nuclear: request identity guard (prevents old request overwriting new match)
        if (isCancelled || activeFixtureIdRef.current !== thisRequestFixtureId) return;

        // CRITICAL: Enhanced fixture_id validation with detailed logging
        // This prevents displaying stale data from previous matches
        const validateFixtureId = (data: any, tableName: string): boolean => {
          if (!data) {
            console.log(`[WarRoom] ${tableName}: No data received`);
            return false;
          }
          
          // Nuclear: use request fixture id + force numeric comparison
          const receivedFixtureId = Number(data.fixture_id || data.id);
          
          // Detailed logging for debugging
          console.log(`[WarRoom] ${tableName} Validation:`, {
            current_fixture_id: thisRequestFixtureId,
            received_fixture_id: receivedFixtureId,
            match: thisRequestFixtureId === receivedFixtureId,
            isCancelled: isCancelled,
          });
          
          // CRITICAL: Check if component was unmounted or match changed
          if (isCancelled || activeFixtureIdRef.current !== thisRequestFixtureId) {
            console.warn(`[WarRoom] ${tableName}: Component cancelled, rejecting data`);
            return false;
          }
          
          // CRITICAL: If fixture_id doesn't match, return null immediately
          if (thisRequestFixtureId !== receivedFixtureId) {
            console.warn(`[WarRoom] ${tableName}: fixture_id mismatch! Rejecting data.`, {
              current: thisRequestFixtureId,
              received: receivedFixtureId,
            });
            return false;
          }
          
          return true;
        };

        // Store raw analysis data with strict validation
        // CRITICAL: Each validation includes table name for logging
        const validatedHdp = validateFixtureId(hdpResult.data, 'handicap') ? hdpResult.data : null;
        const validatedOu = validateFixtureId(ouResult.data, 'OverUnder') ? ouResult.data : null;
        const validatedMoneyLine = validateFixtureId(moneyLineResult.data, 'money line') ? moneyLineResult.data : null;

        if (!isCancelled && activeFixtureIdRef.current === thisRequestFixtureId) {
          setAnalysisData({
            hdp: validatedHdp,
            ou: validatedOu,
            oneXtwo: validatedMoneyLine,
          });
        }

        // Transform to signals only for LIVE matches
        // CRITICAL: Separate signals by category to support tab-specific filtering
        if (match.status === 'LIVE') {
          const hdpSignals: SignalItem[] = [];
          const ouSignals: SignalItem[] = [];
          const oneXtwoSignals: SignalItem[] = [];

        // Transform HDP (Handicap) data - ONLY from handicap table
          if (validatedHdp) {
            const hasRealSignal = validatedHdp.signal && !validatedHdp.signal.includes('观望') && !validatedHdp.signal.includes('持仓');
            hdpSignals.push({
              id: 1,
              type: 'sniper',
              category: 'hdp',
              fixture_id: thisRequestFixtureId,
              league: validatedHdp.league_name || match.league,
              time: validatedHdp.clock ? `LIVE ${validatedHdp.clock}'` : 'LIVE',
              status: 'LIVE',
              timestamp: validatedHdp.clock ? `${validatedHdp.clock}'` : '0\'',
              title: `${validatedHdp.home_name || match.home} vs ${validatedHdp.away_name || match.away}`,
              market: validatedHdp.selection || `Line ${validatedHdp.line || 'N/A'}`,
              odds: parseFloat(validatedHdp.home_odds || validatedHdp.away_odds || '1.88') || 1.88,
              unit: '+1',
              statusText: hasRealSignal ? 'Active 🎯' : 'Monitoring 🔍',
              guruComment: validatedHdp.signal || 'System analyzing handicap movement...',
              stacking_quantity: validatedHdp.stacking_quantity,
              stacking_plan_description: validatedHdp.stacking_plan_description,
              market_analysis_trend_direction: validatedHdp.market_analysis_trend_direction,
              market_analysis_odds_check: validatedHdp.market_analysis_odds_check,
              commentary_malaysia: validatedHdp.commentary_malaysia,
            });
          }

          // Transform O/U (Over/Under) data - ONLY from OverUnder table
          if (validatedOu) {
            const hasRealSignal = validatedOu.signal && !validatedOu.signal.includes('观望') && !validatedOu.signal.includes('持仓');
            ouSignals.push({
              id: 1,
              type: 'sniper',
              category: 'ou',
              fixture_id: thisRequestFixtureId,
              league: validatedOu.league_name || match.league,
              time: validatedOu.clock ? `LIVE ${validatedOu.clock}'` : 'LIVE',
              status: 'LIVE',
              timestamp: validatedOu.clock ? `${validatedOu.clock}'` : '0\'',
              title: `${validatedOu.home_name || match.home} vs ${validatedOu.away_name || match.away}`,
              market: `Over ${validatedOu.line || 'N/A'}`,
              odds: parseFloat(validatedOu.over || '1.88') || 1.88,
              unit: '+1',
              statusText: hasRealSignal ? 'Active 🎯' : 'Monitoring 🔍',
              guruComment: validatedOu.signal || 'Analyzing goal expectancy...',
              stacking_quantity: validatedOu.stacking_quantity,
              stacking_plan_description: validatedOu.stacking_plan_description,
              market_analysis_trend_direction: validatedOu.market_analysis_trend_direction,
              market_analysis_odds_check: validatedOu.market_analysis_odds_check,
              commentary_malaysia: validatedOu.commentary_malaysia,
            });
          }

          // Transform 1X2 (Money Line) data - ONLY from money line table
          if (validatedMoneyLine) {
            const hasRealSignal = validatedMoneyLine.signal && !validatedMoneyLine.signal.includes('观望');
            oneXtwoSignals.push({
              id: 1,
              type: 'sniper',
              category: '1x2',
              fixture_id: thisRequestFixtureId,
              league: validatedMoneyLine.league_name || match.league,
              time: validatedMoneyLine.clock ? `LIVE ${validatedMoneyLine.clock}'` : 'LIVE',
              status: 'LIVE',
              timestamp: validatedMoneyLine.clock ? `${validatedMoneyLine.clock}'` : '0\'',
              title: `${validatedMoneyLine.home_name || match.home} vs ${validatedMoneyLine.away_name || match.away}`,
              market: validatedMoneyLine.selection || 'Market Update',
              odds: parseFloat(validatedMoneyLine.moneyline_1x2_home || validatedMoneyLine.moneyline_1x2_away || '2.0') || 2.0,
              unit: '+1',
              statusText: hasRealSignal ? 'Active 🎯' : 'Monitoring 🔍',
              guruComment: validatedMoneyLine.signal || 'Tracking 1x2 price action...',
              stacking_quantity: validatedMoneyLine.stacking_quantity,
              stacking_plan_description: validatedMoneyLine.stacking_plan_description,
              market_analysis_trend_direction: validatedMoneyLine.market_analysis_trend_direction,
              market_analysis_odds_check: validatedMoneyLine.market_analysis_odds_check,
              commentary_malaysia: validatedMoneyLine.commentary_malaysia,
            });
          }

          // Store signals separately by category for tab-specific filtering
          // ALL tab will combine all three arrays
          // CRITICAL: Only set signals if we have validated data AND component is still mounted
          if (!isCancelled && activeFixtureIdRef.current === thisRequestFixtureId) {
            setLiveSignals([...hdpSignals, ...ouSignals, ...oneXtwoSignals]);
          } else {
            console.log('[WarRoom] Component cancelled, skipping signal update');
          }
        } else {
          // For PRE_MATCH, clear signals to prevent stale data
          if (!isCancelled) {
            setLiveSignals([]);
          }
        }
      } catch (error) {
        console.error('[WarRoom] Error fetching analysis data:', error);
        // CRITICAL: Graceful degradation - set empty state instead of crashing
        // This ensures no stale data is displayed
        if (!isCancelled) {
          setAnalysisData({ hdp: null, ou: null, oneXtwo: null });
          setLiveSignals([]);
        }
      } finally {
        if (!isCancelled && activeFixtureIdRef.current === thisRequestFixtureId) {
          setIsLoadingAnalysis(false);
        }
      }
    };

    // Only fetch if fixtureId is valid
    if (currentFixtureIdFromUrl && !Number.isNaN(currentFixtureIdFromUrl)) {
      void fetchWarRoomAnalysis();
    } else {
      // If fixtureId is invalid, ensure empty state
      setLiveSignals([]);
      setAnalysisData({ hdp: null, ou: null, oneXtwo: null });
      setIsLoadingAnalysis(false);
    }

    // Realtime subscription: Listen for INSERT and UPDATE events on all relevant tables
    // CRITICAL: Must validate payload.new.fixture_id in callback to prevent cross-match updates
    const channels = [
      // HDP (Handicap) table subscription
      sb
        .channel(`warroom-hdp-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'Handicap',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      sb
        .channel(`warroom-handicap-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'handicap',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      // O/U (Over/Under) table subscription
      sb
        .channel(`warroom-overunder-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'OverUnder',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      sb
        .channel(`warroom-over_under-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'over_under',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      // 1X2 (Money Line) table subscription
      sb
        .channel(`warroom-ml-1x2-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'moneyline 1x2',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      sb
        .channel(`warroom-moneyline-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'money line',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
      sb
        .channel(`warroom-moneyline-alt-${thisRequestFixtureId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'moneyline',
        }, (payload) => {
          const payloadData = payload.new as any;
          const pid = Number(payloadData?.fixture_id || payloadData?.id);
          if (pid === thisRequestFixtureId) void fetchWarRoomAnalysis();
        })
        .subscribe(),
    ];

    // CRITICAL: Cleanup function - set isCancelled to prevent stale updates
    return () => {
      isCancelled = true; // Mark as cancelled to prevent any pending async operations
      console.log(`[WarRoom] Cleanup: Cancelling all operations for fixture_id ${thisRequestFixtureId}`);
      channels.forEach(ch => {
        try {
          sb.removeChannel(ch);
        } catch (err) {
          console.warn('[WarRoom] Error removing channel:', err);
        }
      });
      // Clear state on unmount
      setLiveSignals([]);
      setAnalysisData({ hdp: null, ou: null, oneXtwo: null });
    };
  }, [hasEntered, match.id, match.status, match.league, match.home, match.away]);

  // Determine which signals to display based on match status
  const currentFixtureIdForRender = Number(match.id);
  const availableSignals = match.status === 'LIVE' 
    ? liveSignals
    : PRE_MATCH_SIGNALS; // always empty (nuclear)

  // Filter signals by category and type
  // When a specific category is selected (HDP, O/U, 1X2), only show SNIPER type signals for that category
  // When 'all' is selected, show all signals (both sniper and analysis)
  // Nuclear: physical render guard + strict tab isolation
  const fixtureScopedSignals = availableSignals.filter(
    (s) => Number(s.fixture_id) === currentFixtureIdForRender
  );

  const filteredSignals = fixtureScopedSignals.filter((s) => {
    if (filterCategory === 'all') return true;
    return s.category === filterCategory && s.type === 'sniper';
  });
  
  // Order signals: Sniper first, then Analysis (only relevant when 'all' is selected)
  const orderedSignals = [
    ...filteredSignals.filter((s) => s.type === 'sniper'),
    ...filteredSignals.filter((s) => s.type === 'analysis'),
  ];

  // AI Predictions Module Component
  const AIPredictionsModule = () => {
    const [subTab, setSubTab] = useState<'1x2' | 'hdp' | 'ou'>('1x2');
    const [strategyFilter, setStrategyFilter] = useState('Aggressive');
    const [countdown, setCountdown] = useState(8);
    
    // Countdown logic
    useEffect(() => {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 8 : prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }, []);
    
    // Find the signal for current sub-tab
    const activeSignal = fixtureScopedSignals.find(s => s.category === subTab && s.type === 'sniper');
    const data = subTab === '1x2' ? _analysisData.oneXtwo : (subTab === 'hdp' ? _analysisData.hdp : _analysisData.ou);

    const strategyOptions = [
      { id: 'Aggressive', icon: '🔥' },
      { id: 'Conservative', icon: '🛡️' },
      { id: 'Balanced', icon: '⚖️' },
      { id: 'Value Hunter', icon: '💎' },
      { id: 'Safe Play', icon: '🏰' }
    ];

    const getTabColor = (id: string) => {
      switch (id) {
        case '1x2': return 'bg-betting-blue-grad shadow-blue-500/20';
        case 'ou': return 'bg-betting-orange-grad shadow-orange-500/20';
        case 'hdp': return 'bg-betting-purple-grad shadow-purple-500/20';
        default: return 'bg-white/10';
      }
    };

    const getTextGrad = (id: string) => {
      switch (id) {
        case '1x2': return 'bg-betting-blue-grad bg-clip-text text-transparent';
        case 'ou': return 'bg-betting-orange-grad bg-clip-text text-transparent';
        case 'hdp': return 'bg-betting-purple-grad bg-clip-text text-transparent';
        default: return 'text-white';
      }
    };

    const getBgGradient = (id: string) => {
      switch (id) {
        case '1x2': return 'from-blue-500/5 via-transparent to-transparent';
        case 'ou': return 'from-orange-500/5 via-transparent to-transparent';
        case 'hdp': return 'from-purple-500/5 via-transparent to-transparent';
        default: return 'from-transparent';
      }
    };

    const handleOpenHistory = () => {
      setHistoryCategory(subTab);
      setShowHistoryModal(true);
    };

    return (
      <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative font-sans">
        {/* Module Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neon-gold/10 border border-neon-gold/20 flex items-center justify-center">
              <Zap size={18} className="text-neon-gold" fill="currentColor" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight uppercase">AI Predictions</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-gold animate-pulse" />
                <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">{strategyFilter}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button 
              onClick={handleOpenHistory}
              className="text-neon-gold flex items-center gap-1.5 text-[10px] font-bold uppercase hover:opacity-80 transition-opacity"
            >
              <Activity size={12} /> History
            </button>
            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
              <Activity size={10} className="text-neon-gold/60 animate-pulse" />
              <span className="text-[9px] text-gray-400 font-mono">LIVE {countdown}S</span>
            </div>
          </div>
        </div>

        {/* Strategy Filters */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/20">
          {strategyOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setStrategyFilter(opt.id)}
              className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                strategyFilter === opt.id 
                  ? `bg-neon-gold text-black border-transparent shadow-lg shadow-neon-gold/20` 
                  : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10 hover:text-gray-300'
              }`}
            >
              <span>{opt.icon}</span> {opt.id}
            </button>
          ))}
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-3 bg-black/10">
          <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
            {[
              { id: '1x2', label: '1X2' },
              { id: 'ou', label: 'O/U' },
              { id: 'hdp', label: 'HDP' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  subTab === tab.id 
                    ? `${getTabColor(tab.id)} text-white shadow-xl scale-[1.02]` 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Current Prediction Content */}
        <div className={`px-4 pb-4 space-y-4 bg-gradient-to-b ${getBgGradient(subTab)} transition-colors duration-500`}>
          {/* Market & Status Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/5 text-gray-400 border border-white/10 px-2 py-1 rounded-md text-[9px] font-black uppercase">
                {activeSignal?.bookmaker || 'BET365'}
              </div>
              <div className="bg-white/5 text-neon-gold border border-neon-gold/20 px-2 py-1 rounded-md text-[9px] font-black uppercase flex items-center gap-1">
                <Activity size={10} /> {match.status === 'LIVE' ? match.time : (activeSignal?.timestamp || 'PRE')}
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className={`bg-white/5 border border-white/10 px-2 py-1 rounded-md text-[9px] font-black uppercase flex items-center gap-1 ${getTextGrad(subTab)}`}>
                <CheckCircle size={12} className={subTab === '1x2' ? 'text-blue-400' : (subTab === 'ou' ? 'text-orange-400' : 'text-purple-400')} /> {subTab.toUpperCase()} {activeSignal?.line ? `${activeSignal.line}` : ''}
              </div>
              <div className="bg-neon-gold/10 text-neon-gold border border-neon-gold/20 px-2 py-1 rounded-md text-[9px] font-black uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-gold animate-pulse" /> {activeSignal?.signal || 'WAIT'}
              </div>
            </div>
          </div>

          {/* Odds Display */}
          {subTab === '1x2' ? (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'HOME', val: data?.moneyline_1x2_home || '1.03' },
                { label: 'DRAW', val: data?.moneyline_1x2_draw || '15' },
                { label: 'AWAY', val: data?.moneyline_1x2_away || '81' }
              ].map(item => (
                <div key={item.label} className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                  <div className={`text-[8px] font-bold uppercase mb-1 tracking-widest ${getTextGrad('1x2')}`}>{item.label}</div>
                  <div className={`text-lg font-black font-mono ${getTextGrad('1x2')}`}>{item.val}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-center">
                <div className={`text-[9px] font-bold uppercase tracking-widest ${getTextGrad(subTab)}`}>
                  {subTab === 'ou' ? 'Over/Under' : 'Asian Handicap'} <span className="font-mono">{data?.line || '2.5'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: subTab === 'ou' ? 'OVER' : 'HOME', val: subTab === 'ou' ? data?.over : data?.home_odds },
                  { label: subTab === 'ou' ? 'UNDER' : 'AWAY', val: subTab === 'ou' ? data?.under : data?.away_odds }
                ].map(item => (
                  <div key={item.label} className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                    <div className={`text-[8px] font-bold uppercase mb-1 tracking-widest ${getTextGrad(subTab)}`}>{item.label}</div>
                    <div className={`text-lg font-black font-mono ${getTextGrad(subTab)}`}>{item.val || '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Reports */}
          <div className="space-y-3">
            {/* Staking Plan */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neon-gold/10 flex items-center justify-center border border-neon-gold/10">
                    <span className="text-xs">💎</span>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Staking Plan</div>
                    <div className="text-[11px] font-black text-neon-gold">
                      {activeSignal?.stacking_quantity || '0 Unit'} ({activeSignal?.stacking_plan_description || 'No Value'})
                    </div>
                  </div>
                </div>
                <div className="bg-neon-gold/10 px-1.5 py-0.5 rounded border border-neon-gold/20 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-neon-gold" />
                  <span className="text-[8px] text-neon-gold font-bold uppercase">{activeSignal?.signal || 'WAIT'}</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed font-medium bg-black/20 p-2 rounded-lg border border-white/[0.03]">
                {activeSignal?.guruComment || 'Waiting for market liquidity to generate staking guide.'}
              </p>
            </div>

            {/* Commentary Section */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 space-y-2 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                  <MessageSquare size={14} className="text-gray-400" />
                </div>
                <div>
                  <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Commentary</div>
                </div>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed font-bold bg-black/20 p-2 rounded-lg border border-white/[0.03]">
                {activeSignal?.commentary_malaysia || 'Analisis pasaran sedang dijalankan. Sila tunggu isyarat seterusnya.'}
              </p>
            </div>

            {/* Market Performance */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                  <TrendingUp size={14} className="text-gray-500" />
                </div>
                <div>
                  <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Market Performance</div>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed italic">
                {activeSignal?.market_analysis_trend_direction || 'Analyzing market depth and smart money flow...'}
              </p>
              {activeSignal?.market_analysis_odds_check && (
                <div className="pt-2 border-t border-white/5 text-[9px] text-gray-500 font-mono leading-tight">
                  CHECK: {activeSignal.market_analysis_odds_check}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-neon-gold/[0.05] border-t border-neon-gold/10 p-3 flex gap-3 items-center">
          <Info size={14} className="text-neon-gold/60 flex-none" />
          <p className="text-[8px] text-neon-gold/60 leading-tight font-medium uppercase tracking-tight">
            AI predictions are for informational purposes only. Gamble responsibly. 18+ • Powered by OddsFlow AI.
          </p>
        </div>
      </div>
    );
  };

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
              className="space-y-4 pb-28"
            >
              {!hasEntered && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-5">
                  <div className="text-sm font-bold text-neon-gold mb-2">Enter War Room</div>
                  <div className="text-xs text-gray-300 leading-relaxed">
                    温馨提示：报告通常会在 <span className="text-white font-semibold">开赛前 3 分钟</span> 生成。
                    如果还没准备好，你会看到 <span className="text-white font-semibold">“Waiting for AI Analysis…”</span>。
                  </div>
                  <button
                    onClick={() => setHasEntered(true)}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-xl"
                  >
                    Enter War Room <Activity size={16} />
                  </button>
                </div>
              )}

              {hasEntered && (
                <>
                  <AIPredictionsModule />
                </>
              )}

              {/* Original Category Filters (Optional - can be hidden if AIPredictionsModule is primary) */}
              {false && (
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
              )}

              {/* Original Signals List (Optional - can be hidden if AIPredictionsModule is primary) */}
              {false && (
              <div className="space-y-4">
                {!hasEntered ? null : isLoadingAnalysis ? (
                  // Loading state
                  <div className="text-center py-8 text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-neon-gold border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm">Loading analysis...</p>
                  </div>
                ) : orderedSignals.length > 0 ? (
                  // Show signals if available
                  orderedSignals
                    // Nuclear: final physical guard at render time
                    .filter((signal) => Number(signal.fixture_id) === currentFixtureIdForRender)
                    .map((signal) =>
                  signal.type === 'sniper' ? (
                        <SniperTicket key={`${signal.id}-${signal.fixture_id ?? 'na'}`} signal={signal} />
                      ) : (
                        <AnalysisCard key={`${signal.id}-${signal.fixture_id ?? 'na'}`} signal={signal} />
                      )
                    )
                ) : (
                  // Empty state: No analysis data available
                  <div className="text-center py-12 px-4">
                    <div className="bg-surface/50 border border-white/10 rounded-xl p-6">
                      <div className="text-4xl mb-3">🔍</div>
                      <h3 className="text-lg font-bold text-white mb-2">Waiting for AI Analysis...</h3>
                      <p className="text-sm text-gray-400">
                        {filterCategory === 'all' 
                          ? 'Analysis data will appear here once available.'
                          : `${filterCategory.toUpperCase()} analysis is pending.`}
                      </p>
                      {match.status === 'PRE_MATCH' && (
                        <p className="text-xs text-gray-500 mt-2">
                          Warm tip: Reports are usually generated about 3 minutes before kickoff.
                        </p>
                )}
              </div>
                  </div>
                )}
                    </div>
              )}
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

              {!hasEntered ? (
                <div className="bg-black/30 border border-white/10 rounded-xl p-5">
                  <div className="text-sm font-bold text-neon-gold mb-2">Enter War Room</div>
                  <div className="text-xs text-gray-300 leading-relaxed">
                    进入 War Room 后才会开始加载实时数据与聊天内容。
                  </div>
                  <button
                    onClick={() => setHasEntered(true)}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-xl"
                  >
                    Enter War Room <Activity size={16} />
                  </button>
                </div>
              ) : (
                /* Strict Gating: only render LiveChat when a signal exists */
                match.analysis.signal && match.analysis.signal.trim().length > 0 ? (
                  chatUserId && chatUsername ? (
                    <LiveChat
                      fixtureId={match.id}
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
                )
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
              {!hasEntered ? (
                <div className="bg-black/30 border border-white/10 rounded-xl p-5">
                  <div className="text-sm font-bold text-neon-gold mb-2">Enter War Room</div>
                  <div className="text-xs text-gray-300 leading-relaxed">
                    进入 War Room 后才会开始加载 Copy Trade 模块。
                      </div>
                      <button
                    onClick={() => setHasEntered(true)}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-xl"
                  >
                    Enter War Room <Activity size={16} />
                      </button>
                    </div>
              ) : selectedTrader ? (
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

      {/* Signal History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <SignalHistoryModal
            category={historyCategory}
            data={historicalData[historyCategory]}
            onClose={() => setShowHistoryModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
