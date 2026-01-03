import { useEffect, useState, useMemo } from 'react';
import { Zap, TrendingUp, Activity, X as XIcon, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { supabase, oddsSupabase } from '../supabaseClient';

interface MatchAnalysis {
  fixture_id: number;
  matchInfo: any;
  hdp: any | null;
  ou: any | null;
  oneXtwo: any | null;
  lastUpdate: number;
}

export default function RadarScreen(props: {
  telegramId: number;
  onBalanceClick: () => void;
  hideBalance?: boolean;
  onToggleStar: (matchId: number) => void;
}) {
  const { telegramId, onBalanceClick, hideBalance = false, onToggleStar } = props;

  const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
  const [analysisData, setAnalysisData] = useState<Record<number, MatchAnalysis>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Watchlist IDs from Main Supabase
  useEffect(() => {
    if (!telegramId) return;
    const sb = supabase;
    if (!sb) return;

    const fetchWatchlist = async () => {
      const { data, error } = await sb
        .from('user_watchlist')
        .select('fixture_id')
        .eq('telegram_id', telegramId);

      if (!error && data) {
        setWatchlistIds(data.map(d => Number(d.fixture_id)));
      }
      setIsLoading(false);
    };

    fetchWatchlist();

    const channel = sb
      .channel(`radar-watchlist-${telegramId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_watchlist', 
        filter: `telegram_id=eq.${telegramId}` 
      }, () => {
        fetchWatchlist();
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [telegramId]);

  // 2. Fetch Detailed Analysis for each Watchlist Item
  useEffect(() => {
    if (watchlistIds.length === 0) {
      setAnalysisData({});
      return;
    }

    const osb = oddsSupabase;
    if (!osb) return;

    const fetchMatchAnalysis = async (fixtureId: number) => {
      try {
        const queryTable = async (tableName: string, fid: number) => {
          return osb
            .from(tableName)
            .select('*')
            .or(`fixture_id.eq.${fid},id.eq.${fid}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        };

        const tryTableQuery = async (tableNames: string[], fid: number) => {
          for (const tableName of tableNames) {
            const { data } = await queryTable(tableName, fid);
            if (data) return data;
          }
          return null;
        };

        const [matchRes, hdpData, ouData, mlData] = await Promise.all([
          osb.from('prematches').select('*').or(`id.eq.${fixtureId},fixture_id.eq.${fixtureId}`).maybeSingle(),
          tryTableQuery(['handicap', 'Handicap'], fixtureId),
          tryTableQuery(['OverUnder', 'over_under'], fixtureId),
          tryTableQuery(['moneyline 1x2', 'money line', 'moneyline'], fixtureId),
        ]);

        if (matchRes.data) {
          setAnalysisData(prev => ({
            ...prev,
            [fixtureId]: {
              fixture_id: fixtureId,
              matchInfo: matchRes.data,
              hdp: hdpData,
              ou: ouData,
              oneXtwo: mlData,
              lastUpdate: Date.now()
            }
          }));
        }
      } catch (err) {
        console.error(`[Radar] Error fetching analysis for ${fixtureId}:`, err);
      }
    };

    watchlistIds.forEach(id => {
      if (!analysisData[id]) {
        fetchMatchAnalysis(id);
      }
    });

    // Subscriptions for each fixture
    const channels: any[] = [];
    
    watchlistIds.forEach(id => {
      const channel = osb.channel(`radar-fixture-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'prematches' }, (p) => {
          const pid = Number(p.new?.id || p.new?.fixture_id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'handicap' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Handicap' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'OverUnder' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'over_under' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'moneyline 1x2' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'money line' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'moneyline' }, (p) => {
          const pid = Number(p.new?.fixture_id || p.new?.id);
          if (pid === id) fetchMatchAnalysis(id);
        })
        .subscribe();
      
      channels.push(channel);
    });

    return () => {
      channels.forEach(ch => osb.removeChannel(ch));
    };
  }, [watchlistIds]);

  const sortedMatches = useMemo(() => {
    return watchlistIds
      .map(id => analysisData[id])
      .filter(Boolean)
      .sort((a, b) => b.lastUpdate - a.lastUpdate);
  }, [watchlistIds, analysisData]);

  const render1x2Module = (oneXtwo: any) => {
    if (!oneXtwo) return <div className="text-[10px] text-gray-600 italic">No 1x2 data available</div>;
    
    // Compare current with opening (mock logic if opening not in DB)
    const home = Number(oneXtwo.moneyline_1x2_home || 0);
    const draw = Number(oneXtwo.moneyline_1x2_draw || 0);
    const away = Number(oneXtwo.moneyline_1x2_away || 0);
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase">1x2 Movement</span>
          <div className="flex items-center gap-1 text-neon-gold">
            <TrendingUp size={10} />
            <span className="text-[9px] font-bold">HOT GAP</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Home', val: home },
            { label: 'Draw', val: draw },
            { label: 'Away', val: away }
          ].map(item => (
            <div key={item.label} className="bg-black/40 rounded-lg p-2 border border-white/5 text-center">
              <div className="text-[9px] text-gray-500 mb-1">{item.label}</div>
              <div className="text-xs font-black text-white font-mono">{item.val.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAHModule = (hdp: any) => {
    if (!hdp) return <div className="text-[10px] text-gray-600 italic">No AH data available</div>;
    
    const line = hdp.line || '0';
    const homeOdds = Number(hdp.home_odds || 0);
    const awayOdds = Number(hdp.away_odds || 0);
    const bias = Math.abs(homeOdds - awayOdds) > 0.1 ? (homeOdds < awayOdds ? 'HOME' : 'AWAY') : 'NEUTRAL';

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase">AH Bias (HDP: {line})</span>
          {bias !== 'NEUTRAL' && (
            <span className="text-[9px] text-neon-green font-bold flex items-center gap-1">
              <ArrowUpRight size={10} /> {bias} PRESSURE
            </span>
          )}
        </div>
        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden flex border border-white/5">
          <div 
            className="h-full bg-neon-gold transition-all duration-500" 
            style={{ width: `${(homeOdds / (homeOdds + awayOdds)) * 100}%` }} 
          />
          <div 
            className="h-full bg-white/10 transition-all duration-500" 
            style={{ width: `${(awayOdds / (homeOdds + awayOdds)) * 100}%` }} 
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-gray-400">
          <span>H: {homeOdds.toFixed(2)}</span>
          <span>A: {awayOdds.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const renderOUModule = (ou: any) => {
    if (!ou) return <div className="text-[10px] text-gray-600 italic">No OU data available</div>;
    
    const line = ou.line || '2.5';
    const over = Number(ou.over || 0);
    const under = Number(ou.under || 0);
    const sentiment = over < 0.85 ? 'AGGRESSIVE' : over < 0.95 ? 'STEADY' : 'DEFENSIVE';

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500 font-mono uppercase">OU Sentiment (Line: {line})</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
            sentiment === 'AGGRESSIVE' ? 'text-neon-red border-neon-red/30 bg-neon-red/5' : 'text-neon-blue border-neon-blue/30 bg-neon-blue/5'
          }`}>
            {sentiment}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-black/40 rounded-lg p-2 border border-white/5 flex justify-between items-center">
            <span className="text-[9px] text-gray-500">OVER</span>
            <span className="text-xs font-black text-white font-mono">{over.toFixed(2)}</span>
          </div>
          <div className="flex-1 bg-black/40 rounded-lg p-2 border border-white/5 flex justify-between items-center">
            <span className="text-[9px] text-gray-500">UNDER</span>
            <span className="text-xs font-black text-white font-mono">{under.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans min-h-screen">
      <Header onBalanceClick={onBalanceClick} hideBalance={hideBalance} />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-neon-gold text-xs font-bold tracking-widest uppercase">
          <Zap size={14} fill="currentColor" className="animate-pulse" />
          Watchlist Radar
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
          <Activity size={12} className="text-neon-gold animate-pulse" />
          <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">{watchlistIds.length} Monitored</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-neon-gold border-t-transparent rounded-full animate-spin" />
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Calibrating Radar...</div>
        </div>
      ) : watchlistIds.length === 0 ? (
        <div className="text-center py-24 px-10 bg-surface/30 rounded-3xl border border-white/5 border-dashed">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Zap size={32} className="text-gray-700" />
          </div>
          <h3 className="text-lg font-bold text-white mb-3 italic">Your Radar is quiet.</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Add matches to your <span className="text-neon-gold font-bold">Watchlist</span> to start real-time quant analysis and market monitoring.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {sortedMatches.map((match) => {
              const { matchInfo, hdp, ou, oneXtwo } = match;
              const isLive = matchInfo.status_short === 'LIVE' || matchInfo.status_short === '1H' || matchInfo.status_short === '2H';

              return (
                <motion.div
                  key={match.fixture_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="premium-card relative overflow-hidden"
                >
                  <div className="premium-card-content !p-5">
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono truncate mb-1">
                          {matchInfo.league_name}
                        </div>
                        <div className="text-sm font-black text-white truncate">
                          {matchInfo.home_name} <span className="text-gray-600 font-normal italic">vs</span> {matchInfo.away_name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {isLive ? (
                            <span className="text-[10px] text-neon-red font-mono font-bold animate-pulse">● LIVE {matchInfo.goals_home}-{matchInfo.goals_away}</span>
                          ) : (
                            <span className="text-[10px] text-gray-500 font-mono">{new Date(matchInfo.start_date_msia).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleStar(match.fixture_id)}
                        className="p-2 bg-white/5 hover:bg-neon-red/10 hover:text-neon-red rounded-xl transition-colors"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>

                    {/* Quant Modules */}
                    <div className="space-y-5">
                      {/* Module 1: 1x2 */}
                      <div className="relative">
                        {render1x2Module(oneXtwo)}
                      </div>

                      {/* Module 2: AH */}
                      <div className="relative">
                        {renderAHModule(hdp)}
                      </div>

                      {/* Module 3: OU */}
                      <div className="relative">
                        {renderOUModule(ou)}
                      </div>
                    </div>

                    {/* Bottom Meta */}
                    <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-mono uppercase">
                        <Activity size={10} className="text-neon-gold" />
                        Live Feed Active
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono">
                        UPDATED {new Date(match.lastUpdate).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
