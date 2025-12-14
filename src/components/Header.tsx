import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function Header(props: {
  onBalanceClick: () => void;
}) {
  const { onBalanceClick } = props;
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp as
      | { ready?: () => void; initDataUnsafe?: { user?: TelegramUser } }
      | undefined;
    if (!tg) return;

    try {
      tg.ready?.();
    } catch {
      // ignore
    }

    const user = tg.initDataUnsafe?.user ?? null;
    setTgUser(user);
  }, []);

  // Fetch coins from Supabase + subscribe realtime updates
  useEffect(() => {
    const telegramId = tgUser?.id;
    if (!telegramId) return;
    const sb = supabase;
    if (!sb) {
      console.warn('[Header] Supabase client not configured; cannot fetch realtime coins.');
      return;
    }

    let cancelled = false;
    const fetchCoins = async () => {
      // Preferred column: coins
      const resCoins = await sb
        .from('users')
        .select('coins')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (cancelled) return;

      if (!resCoins.error) {
        const next = Number((resCoins.data as any)?.coins ?? 0) || 0;
        setCoins(next);
        return;
      }

      // Fallback: balance (only if coins column doesn't exist in this schema)
      if (String(resCoins.error.message || '').toLowerCase().includes('column') && String(resCoins.error.message || '').toLowerCase().includes('coins')) {
        const resBalance = await sb
          .from('users')
          .select('balance')
          .eq('telegram_id', telegramId)
          .maybeSingle();

        if (cancelled) return;
        if (resBalance.error) {
          console.warn('[Header] Failed to fetch user balance:', resBalance.error);
          return;
        }

        const next = Number((resBalance.data as any)?.balance ?? 0) || 0;
        setCoins(next);
        return;
      }

      console.warn('[Header] Failed to fetch user coins:', resCoins.error);
    };

    void fetchCoins();

    const channel = sb
      .channel(`users-balance-${telegramId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `telegram_id=eq.${telegramId}`,
        },
        (payload: any) => {
          const next =
            Number(payload?.new?.coins ?? payload?.new?.balance ?? 0) || 0;
          setCoins(next);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [tgUser?.id]);

  const displayName = useMemo(() => {
    if (tgUser?.username) return `@${tgUser.username}`;
    if (tgUser?.first_name) return tgUser.first_name;
    return 'Guest';
  }, [tgUser]);

  return (
    <div className="flex justify-between items-center mb-8">
      {/* --- Left: Logo --- */}
      <div className="flex flex-col">
        <div className="flex items-end gap-1">
          <span className="text-neon-green font-black text-2xl tracking-tighter italic">
            ODDSFLOW
          </span>
          <span className="text-white text-[10px] font-bold mb-1 opacity-80">AI</span>
        </div>

        {/* --- User display --- */}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_8px_rgba(0,255,156,0.9)]"></div>
          <span className="text-gray-300 text-[11px] font-medium tracking-wide">
            {displayName}
          </span>
        </div>
      </div>

      {/* --- Right: Balance button (keep style) --- */}
      <button
        onClick={onBalanceClick}
        className="bg-surface-highlight px-3 py-1 rounded-full text-xs font-mono border border-neon-gold/30 text-neon-gold hover:border-neon-gold/50 hover:bg-surface-highlight/80 transition-all cursor-pointer"
      >
        BAL: $
        {coins.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </button>
    </div>
  );
}


