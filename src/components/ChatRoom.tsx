import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';

type ChatMessageRow = {
  id: number;
  telegram_id: number;
  room_id: string;
  username: string;
  content: string;
  created_at: string;
};

export default function ChatRoom(props: {
  roomId?: string;
  userId: number | null;
  username: string | null;
  onBack: () => void;
}) {
  const { userId, username, onBack, roomId = 'global' } = props;

  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return (
      typeof userId === 'number' &&
      Number.isFinite(userId) &&
      userId > 0 &&
      typeof username === 'string' &&
      username.trim().length > 0 &&
      input.trim().length > 0 &&
      !isSending
    );
  }, [input, isSending, userId, username]);

  const scrollToBottom = () => {
    try {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let cancelled = false;

    const loadHistory = async () => {
      const { data, error } = await sb
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        console.error('[ChatRoom] Failed to load chat history:', error);
        return;
      }

      const rows = (data ?? []) as ChatMessageRow[];
      rows.reverse(); // show oldest -> newest
      setMessages(rows);
      queueMicrotask(scrollToBottom);
    };

    void loadHistory();

    const channel = sb
      .channel(`chat-messages-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const row = payload?.new as ChatMessageRow | undefined;
          if (!row || typeof row.id !== 'number') return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          queueMicrotask(scrollToBottom);
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
  }, [roomId]);

  const handleSend = async () => {
    const sb = supabase;
    if (!sb) return;

    const uid = userId;
    const uname = (username ?? '').trim();
    const content = input.trim();

    if (typeof uid !== 'number' || !Number.isFinite(uid) || uid <= 0) return;
    if (!uname) return;
    if (!content) return;
    if (isSending) return;

    setIsSending(true);
    try {
      const { data, error } = await sb
        .from('chat_messages')
        .insert({ telegram_id: uid, room_id: roomId, username: uname, content })
        .select('*')
        .single();

      if (error) {
        console.error('[ChatRoom] Send failed:', error);
        return;
      }

      const row = data as unknown as ChatMessageRow;
      setInput('');
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      queueMicrotask(scrollToBottom);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const isMine = (m: ChatMessageRow) => typeof userId === 'number' && m.telegram_id === userId;

  const title = roomId === 'global' ? '💬 Global Chat' : '💬 War Room Chat';

  return (
    <div className="min-h-screen bg-background text-white max-w-md mx-auto relative font-sans flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-white/10 bg-surface/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-lg font-black text-neon-gold">{title}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!supabase && (
          <div className="text-sm text-gray-400">
            Supabase is not configured. Please set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
          </div>
        )}

        {messages.map((m) => {
          const mine = isMine(m);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 border ${
                  mine
                    ? 'bg-neon-green/15 border-neon-green/30'
                    : 'bg-surface/60 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`text-xs font-semibold ${mine ? 'text-neon-green' : 'text-gray-300'}`}>
                    {m.username || 'Anonymous'}
                  </span>
                  <span className="text-[10px] text-gray-500">{formatTime(m.created_at)}</span>
                </div>
                <div className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="px-4 pb-5 pt-3 border-t border-white/10 bg-surface/80 backdrop-blur-md">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-surface-highlight border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-gold/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSend();
            }}
            disabled={!supabase || isSending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!canSend}
            className={`p-2 rounded-lg transition-all ${
              canSend
                ? 'bg-gradient-to-r from-neon-gold to-orange-500 text-black hover:shadow-lg hover:shadow-neon-gold/50'
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}


