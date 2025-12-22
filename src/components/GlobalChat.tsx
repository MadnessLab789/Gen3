import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';

type UiMessage = {
  id: string;
  content: string;
  created_at: string;
  username: string;
  user_id: number | null;
  avatar_url?: string | null;
  is_bot: boolean;
};

function normalizeGlobalRow(row: any): UiMessage | null {
  const content = String(row?.content ?? row?.message ?? '').trim();
  if (!content) return null;

  const username = String(row?.username ?? row?.sender_name ?? row?.persona_name ?? 'Unknown');
  const created_at = String(row?.created_at ?? row?.inserted_at ?? new Date().toISOString());
  const user_id =
    row?.user_id === null || row?.user_id === undefined
      ? null
      : Number.isFinite(Number(row.user_id))
        ? Number(row.user_id)
        : null;

  const is_bot =
    Boolean(row?.is_bot) ||
    String(row?.sender_type ?? '').toLowerCase() === 'bot' ||
    String(row?.role ?? '').toLowerCase() === 'bot' ||
    username.toLowerCase().includes('bot');

  return {
    id: String(row?.id ?? `${created_at}-${Math.random().toString(16).slice(2)}`),
    content,
    created_at,
    username,
    user_id,
    avatar_url: row?.avatar_url ?? null,
    is_bot,
  };
}

export default function GlobalChat(props: {
  currentUser: { id: number; username: string };
  onBack: () => void;
}) {
  const { currentUser, onBack } = props;
  const [messages, setMessages] = useState<UiMessage[]>([]); // start empty (no mock)
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sb = supabase;

  useEffect(() => {
    if (!sb) return;
    let isCancelled = false;

    const load = async () => {
      const { data, error } = await sb
        .from('global_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (isCancelled) return;
      if (error) {
        console.error('[GlobalChat] load failed:', error);
        setMessages([]);
        return;
      }

      const normalized = (data ?? []).map(normalizeGlobalRow).filter(Boolean) as UiMessage[];
      setMessages(normalized);
      queueMicrotask(scrollToBottom);
    };

    void load();

    const channel = sb
      .channel('realtime-global-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        (payload) => {
          if (isCancelled) return;
          const msg = normalizeGlobalRow(payload.new as any);
          if (!msg) return;
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
        content,
        username: currentUser.username,
        user_id: currentUser.id,
        is_bot: false,
      };

      // Prefer getting inserted row back if table supports it
      const { data, error } = await sb.from('global_messages').insert(payload as any).select('*').single();
      if (error) {
        console.error('[GlobalChat] send failed:', error);
        return;
      }

      const msg = normalizeGlobalRow(data as any);
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
    <div className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-screen max-w-md mx-auto px-4 pt-6 pb-24">
        <header className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-surface-highlight rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <div className="text-xs text-gray-400 font-mono">GLOBAL CHAT</div>
            <div className="text-lg font-bold text-white">Community Lounge</div>
          </div>
        </header>

        <div className="space-y-3">
          {rendered.map((m) => {
            const isUser = m.user_id !== null && m.user_id === currentUser.id && !m.is_bot;
            const bubble =
              m.is_bot
                ? 'bg-purple-500/15 border-purple-400/30 text-white'
                : isUser
                  ? 'bg-blue-500/20 border-blue-400/40 text-white'
                  : 'bg-surface/60 border-white/10 text-white';

            return (
              <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl border px-4 py-3 ${bubble}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-200">{m.username}</span>
                    {m.is_bot && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30 border border-purple-400/30 text-purple-100 font-bold">
                        BOT
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-surface/95 backdrop-blur-xl border-t border-white/10">
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


