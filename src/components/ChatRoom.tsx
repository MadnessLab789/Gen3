import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';

// Stadium Mode message shape (denormalized for high-frequency reads)
interface Message {
  id: number; // BIGINT identity (assumed <= Number.MAX_SAFE_INTEGER)
  content: string;
  sender_id: number;
  sender_type: 'user' | 'bot';
  nickname: string;
  avatar_url?: string;
  created_at: string;
}

type StadiumChatRow = {
  id: number | string;
  content: string;
  sender_id: number | null;
  sender_type: 'user' | 'bot' | null;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
};

const MESSAGE_SELECT = 'id, content, sender_id, sender_type, nickname, avatar_url, created_at';
const HISTORY_LIMIT = 50;

function toIdNumber(id: unknown): number | null {
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string') {
    const n = Number.parseInt(id, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getInitial(name: string) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed[0]?.toUpperCase?.() ?? '?';
}

function normalizeRow(row: StadiumChatRow): Message | null {
  const id = toIdNumber(row.id);
  if (typeof id !== 'number') return null;

  const senderId = typeof row.sender_id === 'number' && Number.isFinite(row.sender_id) ? row.sender_id : 0;
  const senderType = row.sender_type === 'bot' ? 'bot' : 'user';
  const nickname = (row.nickname ?? '').trim() || 'Anonymous';
  const avatarUrl = (row.avatar_url ?? '').trim();

  return {
    id,
    content: row.content ?? '',
    sender_id: senderId,
    sender_type: senderType,
    nickname,
    avatar_url: avatarUrl || undefined,
    created_at: row.created_at,
  };
}

export default function ChatRoom(props: {
  roomId?: string; // kept for UI compatibility (Stadium Mode is currently single stream)
  userId: number | null;
  username: string | null;
  onBack: () => void;
}) {
  const { userId, username, onBack, roomId = 'global' } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [brokenAvatarIds, setBrokenAvatarIds] = useState<Set<string>>(new Set());

  const endRef = useRef<HTMLDivElement | null>(null);
  const messageIdsRef = useRef<Set<number>>(new Set());
  const composerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    try {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let cancelled = false;
    setIsLoading(true);

    const loadHistory = async () => {
      const { data, error } = await sb
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .order('id', { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;
      setIsLoading(false);

      if (error) {
        console.error('[ChatRoom] Failed to load chat history:', error);
        return;
      }

      const rows = (data ?? []) as unknown as StadiumChatRow[];
      const normalized = rows.map(normalizeRow).filter(Boolean) as Message[];
      normalized.reverse(); // oldest -> newest
      setMessages(normalized);
      queueMicrotask(scrollToBottom);
    };

    void loadHistory();

    const channel = sb
      .channel('stadium-chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const row = payload?.new as StadiumChatRow | undefined;
        if (!row) return;
        const msg = normalizeRow(row);
        if (!msg) return;

        setMessages((prev) => {
          if (messageIdsRef.current.has(msg.id) || prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        queueMicrotask(scrollToBottom);
      })
      .subscribe();

    return () => {
      cancelled = true;
      setIsLoading(false);
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, []);

  const title = roomId === 'war-room' ? '💬 Stadium Chat' : '💬 Stadium Chat';

  const renderMessageName = (m: Message) => (m.nickname ?? '').trim() || 'Anonymous';
  const isMine = useMemo(() => {
    return (m: Message) => typeof userId === 'number' && Number.isFinite(userId) && m.sender_id === userId;
  }, [userId]);

  const getTelegramIdentity = () => {
    const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    const tgId = tgUser?.id;
    const firstName = String(tgUser?.first_name ?? '').trim();
    const usernameFromTg = String(tgUser?.username ?? '').trim();
    const photoUrl = String(tgUser?.photo_url ?? '').trim();

    if (typeof tgId === 'number' && Number.isFinite(tgId) && tgId > 0) {
      return {
        sender_id: tgId,
        nickname: firstName || usernameFromTg || 'Anonymous',
        avatar_url: photoUrl || undefined,
      };
    }

    // Fallback for non-Telegram testing: use props
    if (typeof userId === 'number' && Number.isFinite(userId) && userId > 0) {
      return {
        sender_id: userId,
        nickname: (username ?? '').trim() || 'Anonymous',
        avatar_url: undefined,
      };
    }

    return null as null;
  };

  const canSend = useMemo(() => {
    const identity = getTelegramIdentity();
    return Boolean(identity) && input.trim().length > 0 && !isSending && Boolean(supabase);
  }, [input, isSending, userId, username]);

  const handleSendMessage = async () => {
    const sb = supabase;
    if (!sb) return;
    if (isSending) return;

    const identity = getTelegramIdentity();
    if (!identity) return;

    const content = input.trim();
    if (!content) return;

    setIsSending(true);
    try {
      const { data, error } = await sb
        .from('chat_messages')
        .insert({
          content,
          sender_id: identity.sender_id,
          sender_type: 'user',
          nickname: identity.nickname,
          avatar_url: identity.avatar_url ?? null,
        })
        .select(MESSAGE_SELECT)
        .single();

      if (error) {
        console.error('[ChatRoom] Send failed:', error);
        return;
      }

      const row = data as unknown as StadiumChatRow;
      const msg = normalizeRow(row);
      setInput('');
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        queueMicrotask(scrollToBottom);
      }
    } finally {
      setIsSending(false);
    }
  };

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
        {isLoading && <div className="text-xs text-gray-500">Loading messages…</div>}

        {messages.map((m) => {
          const mine = isMine(m);
          const name = renderMessageName(m);
          const avatarUrl = (m.avatar_url ?? '').trim();
          const showAvatarImage = avatarUrl.length > 0 && !brokenAvatarIds.has(String(m.id));

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-end gap-3">
                <div
                  className={`w-9 h-9 rounded-full shrink-0 overflow-hidden border ${
                    mine ? 'border-neon-green/30 bg-neon-green/10' : 'border-neon-gold/25 bg-neon-purple/25'
                  } flex items-center justify-center text-xs font-black text-white`}
                  aria-label={`${name} avatar`}
                  title={name}
                >
                  {showAvatarImage ? (
                    <img
                      src={avatarUrl}
                      alt={`${name} avatar`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setBrokenAvatarIds((prev) => {
                          const next = new Set(prev);
                          next.add(String(m.id));
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <span className="select-none">{getInitial(name)}</span>
                  )}
                </div>

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 border ${
                    mine ? 'bg-neon-green/15 border-neon-green/30' : 'bg-surface/60 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className={`text-xs font-semibold ${mine ? 'text-neon-green' : 'text-gray-300'}`}>
                      {name}
                    </span>
                    <span className="text-[10px] text-gray-500">{formatTime(m.created_at)}</span>
                  </div>
                  <div className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Composer (read-only for now) */}
      <div
        ref={composerRef}
        className="px-4 pb-5 pt-3 border-t border-white/10 bg-surface/80 backdrop-blur-md"
      >
        {!canSend && (
          <div className="mb-2 text-xs text-gray-400">
            To send messages, open inside Telegram (or provide a dev identity).
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-surface-highlight border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-gold/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSendMessage();
            }}
            disabled={!supabase || isSending}
          />
          <button
            onClick={() => void handleSendMessage()}
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


