import { useEffect, useMemo, useState } from 'react';
import { MOCK_TRADERS } from '../mock/traders';
import { supabase } from '../supabaseClient';

interface CopyTradeProps {
  userId: number | null;
  onSelectTrader: (trader: (typeof MOCK_TRADERS)[number]) => void;
}

interface FollowRow {
  trader_id: number;
}

const sparklineByStyle: Record<string, string> = {
  Conservative: '0,14 8,13 16,13 24,12 32,12 40,11 48,11 56,10',
  Stable: '0,14 8,14 16,13 24,13 32,12 40,12 48,12 56,11',
  Safe: '0,14 8,13 16,12 24,12 32,11 40,11 48,11 56,10',
  'Win Streak': '0,16 8,14 16,13 24,11 32,9 40,7 48,5 56,3',
  'Low Frequency': '0,15 8,14 16,13 24,14 32,13 40,12 48,13 56,12',
  'Value Hunting': '0,16 8,12 16,14 24,11 32,13 40,12 48,11 56,12',
  'In-Play': '0,14 8,12 16,15 24,10 32,13 40,12 48,14 56,11',
  Volatile: '0,14 8,6 16,16 24,7 32,15 40,8 48,13 56,4',
  'Totals Specialist': '0,15 8,14 16,12 24,13 32,12 40,12 48,11 56,10',
  Aggressive: '0,14 8,10 16,13 24,9 32,12 40,11 48,13 56,9',
};

function MiniSparkline({ styleKey }: { styleKey: string }) {
  const points = sparklineByStyle[styleKey] ?? sparklineByStyle.Conservative;
  return (
    <svg viewBox="0 0 56 18" className="w-16 h-5">
      <defs>
        <linearGradient id={`miniFill-${styleKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,197,94,0.25)" />
          <stop offset="100%" stopColor="rgba(34,197,94,0)" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="rgba(34,197,94,0.95)" strokeWidth="2" strokeLinecap="round" />
      <polyline points={`${points} 56,18 0,18`} fill={`url(#miniFill-${styleKey})`} stroke="none" />
    </svg>
  );
}

export default function CopyTrade({ userId, onSelectTrader }: CopyTradeProps) {
  const [followedTraderIds, setFollowedTraderIds] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const isAuthenticated = useMemo(
    () => typeof userId === 'number' && Number.isFinite(userId) && userId > 0,
    [userId]
  );

  useEffect(() => {
    const client = supabase;
    if (!client || !isAuthenticated) {
      setFollowedTraderIds([]);
      return;
    }

    let cancelled = false;
    const loadFollows = async () => {
      const { data, error } = await client
        .from('trader_follows')
        .select('trader_id')
        .eq('telegram_id', userId as number);

      if (cancelled) return;
      if (error) {
        console.warn('[CopyTrade] Failed to load follows:', error);
        return;
      }

      const ids = (data as FollowRow[]).map((r) => Number(r.trader_id)).filter((n) => Number.isFinite(n));
      setFollowedTraderIds(ids);
    };

    void loadFollows();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthenticated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleFollow = async (traderId: number) => {
    const client = supabase;
    if (!client || !isAuthenticated) {
      setToast('Please sign in via Telegram');
      return;
    }

    const wasFollowing = followedTraderIds.includes(traderId);
    const optimistic = wasFollowing
      ? followedTraderIds.filter((id) => id !== traderId)
      : [...followedTraderIds, traderId];
    setFollowedTraderIds(optimistic);

    if (wasFollowing) {
      const { error } = await client
        .from('trader_follows')
        .delete()
        .eq('telegram_id', userId as number)
        .eq('trader_id', traderId);

      if (error) {
        setFollowedTraderIds(followedTraderIds); // rollback
        setToast('Unfollow failed');
        return;
      }
      setToast('Unfollowed');
      return;
    }

    const { error } = await client
      .from('trader_follows')
      .insert({ telegram_id: userId as number, trader_id: traderId });

    if (error) {
      setFollowedTraderIds(followedTraderIds); // rollback
      setToast('Follow failed');
      return;
    }

    setToast('Followed');
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="rounded-xl border border-neon-gold/40 bg-black/60 px-4 py-3 text-neon-gold text-sm font-semibold">
          {toast}
        </div>
      )}

      {MOCK_TRADERS.map((trader) => {
        const isFollowing = followedTraderIds.includes(trader.id);
        const initials = trader.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <div
            key={trader.id}
            className="bg-surface/60 rounded-lg p-4 border border-white/5 hover:border-neon-purple/30 transition-all"
            onClick={() => onSelectTrader(trader)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border border-white/10 text-black"
                  style={{ backgroundColor: trader.avatarColor }}
                >
                  {initials}
                </div>
                <div>
                  <div className="text-white font-semibold leading-tight">{trader.name}</div>
                  <div className="text-[11px] text-gray-400">{trader.role}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {trader.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFollow(trader.id);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border ${
                    isFollowing
                      ? 'bg-neon-green/20 text-neon-green border-neon-green/30'
                      : 'bg-gradient-to-r from-neon-gold to-orange-500 text-black border-transparent hover:shadow-lg hover:shadow-neon-gold/50'
                  }`}
                >
                  {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                </button>
                <MiniSparkline styleKey={trader.style} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
              <div>
                <div className="text-gray-400">ROI</div>
                <div className="text-2xl font-black text-neon-green">+{trader.roi}%</div>
              </div>
              <div>
                <div className="text-gray-400">Win Rate</div>
                <div className="text-lg font-bold text-white">{trader.winRate}%</div>
              </div>
              <div>
                <div className="text-gray-400">Profit Factor</div>
                <div className="text-lg font-bold text-neon-gold">{trader.profitFactor.toFixed(1)}</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              Recent: {trader.recentHistory.join(' • ')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

