import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Globe, Send } from 'lucide-react';
import { supabase } from '../../supabaseClient';

type GlobalChatRow = {
  id: string;
  created_at: string;
  sender_name: string;
  content: string;
  role: 'ai' | 'user' | string;
};

const DEFAULT_PIXEL_AVATAR =
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" shape-rendering="crispEdges">
      <rect width="32" height="32" fill="#0b1220"/>
      <rect x="6" y="6" width="20" height="20" rx="6" fill="#1f2a44"/>
      <rect x="10" y="12" width="4" height="4" fill="#00E5FF"/>
      <rect x="18" y="12" width="4" height="4" fill="#00E5FF"/>
      <rect x="12" y="20" width="8" height="3" fill="#00E5FF"/>
    </svg>`
  )}`;

function normalize(row: any): GlobalChatRow | null {
  const content = String(row?.content ?? '').trim();
  if (!content) return null;

  const sender_name = String(row?.sender_name ?? 'Unknown');
  const created_at = String(row?.created_at ?? new Date().toISOString());
  const id = String(row?.id ?? `${created_at}-${Math.random().toString(16).slice(2)}`);
  const role = String(row?.role ?? 'user');

  return { id, created_at, sender_name, content, role };
}

function mergeAndSort(prev: GlobalChatRow[], next: GlobalChatRow[]): GlobalChatRow[] {
  const byId = new Map<string, GlobalChatRow>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of next) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export default function GlobalChat(props: {
  currentUser: { id: number; username: string };
  onBack: () => void;
  withTabBar?: boolean;
}) {
  const { currentUser, onBack, withTabBar = false } = props;
  const sb = supabase;

  const [messages, setMessages] = useState<GlobalChatRow[]>([]); // start empty (no mock)
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const initialLoadedRef = useRef(false);

  // Online count
  const [realTimeCount, setRealTimeCount] = useState(0); // Presence
  const [simulatedCount, setSimulatedCount] = useState(0); // system_configs offset

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Always land at the bottom after initial fetch and after inserts
  useLayoutEffect(() => {
    if (!initialLoadedRef.current) return;
    // Force scroll so users don't think "no data" when messages are below fold
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!sb) return;
    let isCancelled = false;

    const fetchMessages = async () => {
      const { data, error } = await sb
        .from('global_chat_messages')
        .select('id, created_at, sender_name, content, role')
        // Fetch newest first, then reverse in UI to show oldest -> newest
        .order('created_at', { ascending: false })
        .limit(50);

      if (isCancelled) return;
      if (error) {
        console.error('[GlobalChat] fetch failed (check RLS/permissions):', error);
        setMessages([]);
        return;
      }

      const normalized = (data ?? []).map(normalize).filter(Boolean) as GlobalChatRow[];
      // We fetched DESC, so reverse to ASC for display
      normalized.reverse();
      initialLoadedRef.current = true;
      // Merge instead of overwrite: realtime inserts can arrive while fetch is in flight
      setMessages((prev) => mergeAndSort(prev, normalized));
    };

    void fetchMessages();

    const channel = sb
      .channel('realtime-global-chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_chat_messages' },
        (payload) => {
          if (isCancelled) return;
          const msg = normalize(payload.new as any);
          if (!msg) return;
          // Merge + keep chronological order; never replace whole array
          setMessages((prev) => mergeAndSort(prev, [msg]));
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [sb]);

  // Presence: track real websocket online count
  useEffect(() => {
    if (!sb) return;
    let isCancelled = false;

    const channel = sb.channel('lounge-room', {
      config: { presence: { key: String(currentUser.id) } },
    });

    const recompute = () => {
      if (isCancelled) return;
      const state = channel.presenceState() as Record<string, unknown[]>;
      const count = Object.values(state).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
      setRealTimeCount(count);
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute);

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // Track this client as online
      void channel.track({ online_at: new Date().toISOString() });
    });

    return () => {
      isCancelled = true;
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [sb, currentUser.id]);

  // system_configs: realtime simulated offset (key === 'simulated_user_offset')
  useEffect(() => {
    if (!sb) return;
    let isCancelled = false;

    const fetchOffset = async () => {
      const { data, error } = await sb
        .from('system_configs')
        .select('value_int')
        .eq('key', 'simulated_user_offset')
        .maybeSingle();

      if (isCancelled) return;
      if (error) {
        console.warn('[GlobalChat] Failed to fetch simulated_user_offset:', error);
        setSimulatedCount(0);
        return;
      }
      setSimulatedCount(Number((data as any)?.value_int ?? 0) || 0);
    };

    void fetchOffset();

    const ch = sb
      .channel('realtime-system-configs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_configs',
          filter: 'key=eq.simulated_user_offset',
        },
        (payload) => {
          if (isCancelled) return;
          const row = payload.new as any;
          if (row?.key !== 'simulated_user_offset') return;
          setSimulatedCount(Number(row?.value_int ?? 0) || 0);
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      try {
        sb.removeChannel(ch);
      } catch {
        // ignore
      }
    };
  }, [sb]);

  const displayCount = useMemo(() => {
    const total = (Number(realTimeCount) || 0) + (Number(simulatedCount) || 0);
    return Math.max(0, total);
  }, [realTimeCount, simulatedCount]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !sb || sending) return;

    setSending(true);
    try {
      const payload = {
        sender_name: currentUser.username,
        content,
        role: 'user',
      };

      const { data, error } = await sb
        .from('global_chat_messages')
        .insert(payload as any)
        .select('id, created_at, sender_name, content, role')
        .single();

      if (error) {
        console.error('[GlobalChat] send failed:', error);
        return;
      }

      const msg = normalize(data as any);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setText('');
        queueMicrotask(scrollToBottom);
      }
    } finally {
      setSending(false);
    }
  };

  const rendered = useMemo(() => messages, [messages]);

  return (
    <div className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-xl">
      <div className="h-full max-w-md mx-auto flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 px-4 py-4 bg-slate-900/60 backdrop-blur-md border-b border-white/10">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 hover:bg-surface-highlight rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-[inset_0_0_10px_rgba(59,130,246,0.25)] shadow-black/40">
                <Globe className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.35)]" />
              </div>

              <div className="min-w-0">
                <div className="text-xl font-black tracking-wide truncate bg-gradient-to-r from-[#60A5FA] to-[#34D399] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">
                  GLOBAL CHAT
                </div>
                <div className="text-xs font-medium text-cyan-400/60 tracking-widest truncate">
                  ODDSFLOW Lounge
                </div>
              </div>
            </div>
          </div>

          {/* Right: Online Count */}
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-2 text-sm font-mono text-gray-200 leading-none">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#22c55e]" />
              <span
                className="min-w-[4ch] text-right text-[#FDE047]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {displayCount}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 uppercase leading-none mt-1">
              Members Online
            </div>
          </div>
        </header>

        {/* Messages (scroll area) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {rendered.map((m) => {
            const isAi = String(m.role).toLowerCase() === 'ai';
            const isSelf = !isAi && m.sender_name === currentUser.username;
            const bubble = isSelf
              ? 'bg-blue-500/20 border-blue-400/40 text-white'
              : 'bg-surface/60 border-white/10 text-white';

            // AI always left; user self always right; other users left
            const alignRight = isSelf;
            const avatarSrc = DEFAULT_PIXEL_AVATAR;

            return (
              <div key={m.id} className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-2 ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img
                    src={avatarSrc}
                    alt={m.sender_name}
                    className="w-8 h-8 rounded-full border border-white/10 bg-black/30 object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`max-w-[78%] rounded-2xl border px-4 py-3 ${bubble}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-200">{m.sender_name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Input bar (pinned bottom) */}
        <div
          className={`sticky bottom-0 z-50 border-t border-white/10 bg-background/80 backdrop-blur-xl px-4 py-3 ${
            withTabBar ? 'pb-[calc(env(safe-area-inset-bottom)+96px)]' : 'pb-[env(safe-area-inset-bottom)]'
          }`}
        >
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-gold/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={!sb || sending}
            />
            <button
              onClick={() => void handleSend()}
              className="px-4 rounded-xl bg-neon-gold text-black font-black disabled:opacity-50"
              disabled={!sb || sending || !text.trim()}
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


