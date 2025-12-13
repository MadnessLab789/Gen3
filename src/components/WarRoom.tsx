import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare, TrendingUp, Users, Send, X, CheckCircle, Info, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OddsChart from './OddsChart';
import TraderProfile from './TraderProfile';

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
}

type TabType = 'signals' | 'chat' | 'copyTrade';

interface ChatMessage {
  id: number;
  user: string;
  message: string;
  time: string;
}

interface Trader {
  id: number;
  name: string;
  roi: string;
  avatar: string;
  history?: string[];
}

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

const initialChatMessages: ChatMessage[] = [
  { id: 1, user: 'WhaleHunter', message: 'All in Home!', time: '2m ago' },
  { id: 2, user: 'SharpBet', message: 'Ref is blind!', time: '5m ago' },
  { id: 3, user: 'ProTrader', message: 'Volume spike detected', time: '8m ago' },
  { id: 4, user: 'OddsMaster', message: 'Line moved, still value', time: '12m ago' },
];

const mockTraders: Trader[] = [
  { id: 1, name: 'WhaleHunter', roi: '+247%', avatar: '🐋', history: ['W', 'W', 'L', 'W', 'W', 'W', 'L', 'W', 'W', 'W'] },
  { id: 2, name: 'SharpBet', roi: '+189%', avatar: '🎯', history: ['W', 'L', 'W', 'W', 'L', 'W', 'W', 'W', 'L', 'W'] },
  { id: 3, name: 'ProTrader', roi: '+312%', avatar: '⚡', history: ['W', 'W', 'W', 'L', 'W', 'W', 'W', 'W', 'L', 'W'] },
];

const MOCK_SIGNALS: SignalItem[] = [
  {
    id: 1,
    type: 'sniper',
    category: '1x2',
    league: 'UEFA CL',
    time: "LIVE 23'",
    status: 'LIVE',
    timestamp: "23'",
    title: 'Qarabağ vs Ajax',
    market: 'AWAY WIN',
    odds: 3.29,
    unit: '+1',
    statusText: 'Holding 💼',
  },
  {
    id: 2,
    type: 'analysis',
    category: 'hdp',
    league: 'UEFA CL',
    time: "LIVE 6'",
    status: 'LIVE',
    timestamp: "6'",
    title: 'HDP 亚盘狙击 (v5.1 Optimized)',
    strategy: '🟢 追主队',
    suggestion: 'Home -0.25',
    reasoning:
      '盘口在 Home -0.25 维持不变，但主队赔率从 2.02 降至 1.99，这符合 “同盘降水” 的强力攻击信号。庄家在不升盘的情况下降低赔付，说明资金流向主队，且当前水位 1.99 处于健康的 1.75-2.05 区间，是进场的理想时机。',
    stats: [
      '趋势: 庄家悄悄降低主队水位 (同盘降水)',
      '变盘: Home -0.25 (盘口不变)',
      '抽水: ✅ -',
    ],
    guruComment:
      'Eh brader，你看这个水位，从 2.02 慢慢跌到 1.99，盘口又没动，庄家不是傻的，这是在收水啊！主队 Leverkusen -0.25，水位又靓仔 (1.99)，不冲现在冲几时？这个可以买！1 Unit 先下，不要等了。',
  },
  {
    id: 3,
    type: 'analysis',
    category: 'ou',
    league: 'UEFA CL',
    time: "LIVE 46'",
    status: 'LIVE',
    timestamp: "46'",
    title: 'O/U 大小球火力追踪',
    strategy: '🟢 追大球',
    suggestion: 'Over 2.75',
    reasoning:
      '中场结束后盘口保持在 2.75，水位略微下调，双方节奏偏快且前场尝试增多，后半场预期会拉高射门数。水位下调但盘口不抬，显示庄家对进球持开放态度。',
    stats: [
      '趋势: 中场后水位微降但盘口不动',
      '变盘: 2.75 固定',
      '抽水: ✅ 健康区间',
    ],
    guruComment:
      '下半场会更凶，Over 2.75 现在跟上，别等盘口抬高。1 Unit 先走，不贪多。',
  },
];

// BettingSheet Component
interface BettingSheetProps {
  match: Match;
  betAmount: number;
  onBetAmountChange: (amount: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function BettingSheet({ match, betAmount, onBetAmountChange, onConfirm, onClose }: BettingSheetProps) {
  const balance = 1240; // Mock balance
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

export default function WarRoom({ match, onClose, onUpdateBalance, onVipPurchase, isVip = false }: WarRoomProps) {
  const VIP_CHANNEL_URL = 'https://t.me/your_channel';

  const [activeTab, setActiveTab] = useState<TabType>('signals');
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [inputText, setInputText] = useState('');
  const [following, setFollowing] = useState<number[]>([]);
  const [showBettingSlip, setShowBettingSlip] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SignalItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | '1x2' | 'hdp' | 'ou'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [readCategories, setReadCategories] = useState<Set<string>>(new Set());
  const [activeTrader, setActiveTrader] = useState<Trader | null>(null);
  const [settlementResult, setSettlementResult] = useState<'WON' | 'LOST' | null>(null);
  const [winAmount, setWinAmount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'signals' as TabType, label: 'Signals', icon: TrendingUp },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare },
    { id: 'copyTrade' as TabType, label: 'Copy Trade', icon: Users },
  ];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

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

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        user: 'Me',
        message: inputText.trim(),
        time: 'now',
      };
      setMessages([...messages, newMessage]);
      setInputText('');
    }
  };

  const handleFollow = (traderId: number) => {
    setFollowing((prev) =>
      prev.includes(traderId)
        ? prev.filter((id) => id !== traderId)
        : [...prev, traderId]
    );
  };

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

  const handleGoToChannel = () => {
    try {
      window.open(VIP_CHANNEL_URL, '_blank');
    } catch {
      // ignore
    }
  };

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

        <button
          onClick={handlePlaceBet}
          className="w-full mt-2 py-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-bold text-sm rounded-lg hover:shadow-lg hover:shadow-neon-gold/40 transition-all"
        >
          Follow Bet
        </button>
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
                onClick={handleGoToChannel}
                className="w-full py-2 bg-white/5 text-white font-bold text-sm rounded-lg border border-white/10 hover:border-neon-blue/50 hover:bg-white/10 transition-all"
              >
                Go to Channel for Discussion
              </button>
              <button
                onClick={handlePlaceBet}
                className="w-full py-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-bold text-sm rounded-lg hover:shadow-lg hover:shadow-neon-gold/40 transition-all"
              >
                Follow Bet
              </button>
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

  // Filter and order signals: Sniper first, then Analysis
  const filteredSignals = MOCK_SIGNALS.filter(
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
                  { id: '1x2', label: '1X2' },
                  { id: 'hdp', label: 'HDP' },
                  { id: 'ou', label: 'O/U' },
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
                      {match.analysis.signal}
                    </div>
                    <div className="text-sm text-neon-blue font-mono">@ {match.analysis.odds}</div>
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
              ref={chatContainerRef}
            >
              {messages.map((msg) => {
                const isMe = msg.user === 'Me';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-lg p-3 border max-w-[80%] ${
                        isMe
                          ? 'bg-neon-blue/20 border-neon-blue/30'
                          : 'bg-surface/60 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold ${
                            isMe ? 'text-neon-blue' : 'text-neon-gold'
                          }`}
                        >
                          {msg.user}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-2">{msg.time}</span>
                      </div>
                      <p className="text-sm text-white">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
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
              {mockTraders.map((trader) => {
                const isFollowing = following.includes(trader.id);
                return (
                  <div
                    key={trader.id}
                    className="bg-surface/60 rounded-lg p-4 border border-white/5 flex items-center justify-between hover:border-neon-purple/30 transition-all cursor-pointer"
                    onClick={() => setActiveTrader(trader)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-neon-purple/20 flex items-center justify-center text-2xl">
                        {trader.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{trader.name}</div>
                        <div className="text-sm text-neon-green font-mono">{trader.roi} ROI</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(trader.id);
                      }}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                        isFollowing
                          ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                          : 'bg-gradient-to-r from-neon-gold to-orange-500 text-black hover:shadow-lg hover:shadow-neon-gold/50'
                      }`}
                    >
                      {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Input / CTA */}
      {activeTab === 'chat' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-surface/95 backdrop-blur-xl border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message..."
              className="flex-1 bg-surface-highlight border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-gold/50"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              className="p-2 bg-gradient-to-r from-neon-gold to-orange-500 text-black rounded-lg hover:shadow-lg hover:shadow-neon-gold/50 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}


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

      {/* Trader Profile Modal */}
      <AnimatePresence>
        {activeTrader && (
          <TraderProfile
            trader={activeTrader}
            isFollowing={following.includes(activeTrader.id)}
            onFollow={() => handleFollow(activeTrader.id)}
            onClose={() => setActiveTrader(null)}
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
