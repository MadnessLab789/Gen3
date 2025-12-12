import { useState } from 'react';
import { Star, Zap, Activity, Trophy, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WarRoom from './components/WarRoom';
import WalletModal from './components/WalletModal';

// --- 辅助函数：生成模拟波浪数据 ---
const generateWaveData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    name: i,
    value: 30 + Math.random() * 60 // 生成 30-90 之间的随机数
  }));
};

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
  chartData: any[]; // 新增：图表数据
}

// --- 数据源 (带图表数据) ---
const INITIAL_MATCHES: Match[] = [
  {
    id: 1,
    league: 'Champions League',
    home: 'Arsenal',
    away: 'PSG',
    time: '20:45',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔥 High Vol', '🐳 Whale Alert'],
    tagColor: 'neon-purple',
    analysis: {
      signal: 'OVER 2.5',
      odds: 1.95,
      confidence: 88,
      guruComment: 'Market indicates heavy volume on Over.'
    },
    chartData: generateWaveData()
  },
  {
    id: 2,
    league: 'Premier League',
    home: 'Man City',
    away: 'Liverpool',
    time: 'LIVE 12\'',
    status: 'LIVE',
    score: '0-1',
    isStarred: true, 
    tags: ['⚡️ Sniper Signal'],
    tagColor: 'neon-green',
    analysis: {
      signal: 'HOME WIN',
      odds: 2.10,
      confidence: 92,
      guruComment: 'Early goal implies strong home comeback.'
    },
    chartData: generateWaveData()
  },
  {
    id: 3,
    league: 'La Liga',
    home: 'Real Madrid',
    away: 'Getafe',
    time: '22:00',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔒 Defense Heavy'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'UNDER 3.5',
      odds: 1.50,
      confidence: 75,
      guruComment: 'Defensive lineup confirmed.'
    },
    chartData: generateWaveData()
  }
];

function App() {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [showWallet, setShowWallet] = useState(false);
  const [balance, setBalance] = useState(1240);

  const toggleStar = (id: number) => {
    setMatches(prev => prev.map(m => 
      m.id === id ? { ...m, isStarred: !m.isStarred } : m
    ));
  };

  const starredMatches = matches.filter(m => m.isStarred);
  const unstarredMatches = matches.filter(m => !m.isStarred);

  return (
    <div className="min-h-screen bg-background text-white pb-20 px-4 pt-6 max-w-md mx-auto relative font-sans">
      
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black italic tracking-tighter text-neon-green">
          ODDSFLOW<span className="text-white not-italic text-sm font-normal ml-1">AI</span>
        </h1>
        <button
          onClick={() => setShowWallet(true)}
          className="bg-surface-highlight px-3 py-1 rounded-full text-xs font-mono border border-neon-gold/30 text-neon-gold hover:border-neon-gold/50 hover:bg-surface-highlight/80 transition-all cursor-pointer"
        >
          BAL: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </button>
      </header>

      <AnimatePresence>
        {starredMatches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3 text-neon-gold text-xs font-bold tracking-widest uppercase">
              <Star size={12} fill="currentColor" />
              Watchlist & Signals
            </div>
            
            <div className="space-y-4">
              {starredMatches.map(match => (
                <motion.div 
                  layoutId={`match-${match.id}`}
                  key={match.id} 
                  className="bg-surface/80 backdrop-blur-md border border-neon-purple/20 rounded-xl p-4 shadow-[0_0_20px_rgba(127,86,217,0.1)] relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <Trophy size={10} /> {match.league}
                      </span>
                      <h3 className="text-lg font-bold mt-1">{match.home} <span className="text-gray-500 text-sm">vs</span> {match.away}</h3>
                      {match.status === 'LIVE' && <span className="text-neon-red font-mono text-xs animate-pulse block mt-1">● LIVE {match.score}</span>}
                    </div>
                    <button onClick={() => toggleStar(match.id)}>
                      <Star className="text-neon-gold" fill="#FFC200" size={20} />
                    </button>
                  </div>

                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-neon-green">
                        <Zap size={16} fill="currentColor" />
                        <span className="font-bold font-mono tracking-wider">AI SIGNAL</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-black text-white leading-none">{match.analysis.signal}</span>
                        <span className="text-xs text-neon-blue font-mono">@ {match.analysis.odds}</span>
                      </div>
                    </div>
                    
                    {/* --- 比赛氛围海报 (纯 CSS 绘制版) --- */}
                    <div className="relative h-40 rounded-lg overflow-hidden mt-4 mb-4 border border-white/5 group-hover:border-neon-purple/50 transition-all bg-[#050B14]">
                      
                      {/* 1. 底部绿色光晕 (模拟草坪) */}
                      <div className="absolute bottom-[-20%] left-0 right-0 h-1/2 bg-neon-green/20 blur-[40px] rounded-full"></div>
                      
                      {/* 2. 顶部聚光灯效果 (模拟球场灯光) */}
                      <div className="absolute top-[-50%] left-[-20%] w-[140%] h-full bg-neon-blue/10 blur-[60px] rotate-12"></div>
                      
                      {/* 3. 科技感网格线 (装饰) */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                          backgroundSize: '40px 40px',
                        }}
                      ></div>

                      {/* LIVE 标签 */}
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-neon-red/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse z-10 shadow-[0_0_10px_rgba(255,59,48,0.5)]">
                        <span className="w-1.5 h-1.5 bg-white rounded-full inline-block"></span>
                        LIVE CAM
                      </div>

                      {/* 氛围文字 */}
                      <div className="absolute bottom-3 left-3 z-10">
                        <div className="font-black italic text-2xl text-white tracking-tighter drop-shadow-lg">
                          GAME ON.
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">Real-time Data Feed</div>
                      </div>
                    </div>

                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-500">AI Confidence</span>
                      <span className="text-[10px] text-neon-green font-mono">{match.analysis.confidence}%</span>
                    </div>

                    {match.analysis.guruComment && (
                      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-400 italic">
                        "{match.analysis.guruComment}"
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setActiveMatch(match)}
                    className="w-full mt-3 py-3 bg-gradient-to-r from-neon-gold to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-neon-gold/50 transition-all active:scale-95 rounded-lg"
                  >
                    Enter War Room <Activity size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
          <Clock size={12} /> Upcoming / Live
        </h2>
        
        <div className="space-y-2">
          {unstarredMatches.map(match => (
            <motion.div 
              layoutId={`match-${match.id}`}
              key={match.id}
              className="group bg-surface hover:bg-surface-highlight border border-neon-purple/20 rounded-lg p-3 flex items-center justify-between transition-colors cursor-pointer"
              onClick={() => toggleStar(match.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 text-center border-r border-white/5 pr-3">
                   <span className="text-xs font-mono text-gray-400 block">{match.time.replace('LIVE', '')}</span>
                   {match.status === 'LIVE' && <span className="text-[8px] text-neon-red font-bold">LIVE</span>}
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">
                    {match.home} <span className="text-gray-600">vs</span> {match.away}
                  </div>
                  <div className="flex gap-2">
                    {match.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-2 text-gray-600 group-hover:text-neon-gold transition-colors">
                <Star size={18} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* War Room Modal */}
      <AnimatePresence>
        {activeMatch && (
          <WarRoom 
            match={activeMatch} 
            onClose={() => setActiveMatch(null)}
            onUpdateBalance={(amount) => setBalance(prev => prev + amount)}
          />
        )}
      </AnimatePresence>

      {/* Wallet Modal */}
      <AnimatePresence>
        {showWallet && (
          <WalletModal balance={balance} onClose={() => setShowWallet(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;