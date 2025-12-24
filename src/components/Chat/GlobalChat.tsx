import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
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

export default function GlobalChat(props: {
  currentUser: { id: number; username: string };
  onBack: () => void;
}) {
  const { currentUser, onBack } = props;
  const sb = supabase;

  const [messages, setMessages] = useState<GlobalChatRow[]>([]); // start empty (no mock)
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const initialLoadedRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Always land at the bottom after initial fetch and after inserts
  useLayoutEffect(() => {
    if (!initialLoadedRef.current) return;
    // Force scroll so users don't think "no data" when messages are below fold
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
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
      setMessages(normalized);
      initialLoadedRef.current = true;
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }));
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
          // Append to the end (do NOT replace whole array)
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          queueMicrotask(scrollToBottom);
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
        <header className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-white/10">
          <button onClick={onBack} className="p-2 hover:bg-surface-highlight rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <div className="text-xs text-gray-400 font-mono">GLOBAL CHAT</div>
            <div className="text-lg font-bold text-white">ODDSFLOW Lounge</div>
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
        <div className="sticky bottom-0 z-50 border-t border-white/10 bg-background/80 backdrop-blur-xl px-4 py-3 pb-[env(safe-area-inset-bottom)]">
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


