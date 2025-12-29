import { Zap } from 'lucide-react';
import { Header } from './Header';

type Match = {
  id: number;
  league: string;
  home: string;
  away: string;
  time: string;
  status: 'LIVE' | 'PRE_MATCH';
  score?: string;
  date?: string;
  homeLogo?: string;
  awayLogo?: string;
  isStarred: boolean;
};

export default function RadarScreen(props: {
  matches: Match[];
  onEnterWarRoom: (matchId: number) => void;
  onToggleStar: (matchId: number) => void;
  onBalanceClick: () => void;
}) {
  const { matches, onEnterWarRoom, onToggleStar, onBalanceClick } = props;

  const live = matches.filter((m) => m.status === 'LIVE');
  const starred = matches.filter((m) => m.isStarred);

  return (
    <div className="pb-[96px] px-4 pt-6 max-w-md mx-auto relative">
      <Header onBalanceClick={onBalanceClick} />

      <div className="flex items-center gap-2 mb-3 text-neon-gold text-xs font-bold tracking-widest uppercase">
        <Zap size={12} fill="currentColor" />
        Radar Feed
      </div>

      <div className="bg-surface/80 backdrop-blur-md border border-white/10 rounded-xl p-4 mb-4">
        <div className="text-xs text-gray-400 font-mono">Status</div>
        <div className="text-white font-black text-lg">Scanning live markets…</div>
        <div className="text-[11px] text-gray-400 mt-1">
          This page can evolve into a real-time “signals radar” later. For now it highlights Live + Watchlist.
        </div>
      </div>

      {starred.length > 0 && (
        <div className="mb-6">
          <div className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Watchlist</div>
          <div className="space-y-2">
            {starred.map((m) => (
              <div
                key={m.id}
                className="bg-surface border border-neon-purple/20 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs text-gray-400 font-mono truncate">{m.league}</div>
                  <div className="text-sm font-bold text-white truncate">
                    {m.home} <span className="text-gray-500">vs</span> {m.away}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    {m.status === 'LIVE' ? `LIVE ${m.score ?? ''}` : m.time}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleStar(m.id)}
                    className="px-2 py-1 text-[10px] font-mono text-neon-gold border border-neon-gold/30 rounded-lg"
                  >
                    STAR
                  </button>
                  <button
                    onClick={() => onEnterWarRoom(m.id)}
                    className="px-2 py-1 text-[10px] font-mono text-black bg-neon-gold rounded-lg"
                  >
                    OPEN
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-2">Live Now</div>
      <div className="space-y-2">
        {live.length === 0 ? (
          <div className="text-sm text-gray-400 bg-black/30 border border-white/10 rounded-xl p-4">
            No live matches right now.
          </div>
        ) : (
          live.map((m) => (
            <div
              key={m.id}
              className="bg-surface border border-neon-purple/20 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-xs text-gray-400 font-mono truncate">{m.league}</div>
                <div className="text-sm font-bold text-white truncate">
                  {m.home} <span className="text-gray-500">vs</span> {m.away}
                </div>
                <div className="text-[11px] text-neon-red font-mono animate-pulse">● LIVE {m.score ?? ''}</div>
              </div>
              <button
                onClick={() => onEnterWarRoom(m.id)}
                className="px-3 py-2 text-xs font-black text-black bg-gradient-to-r from-neon-gold to-orange-500 rounded-lg"
              >
                WAR ROOM
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


