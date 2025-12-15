import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CornerUpLeft, Heart, Send, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Message } from '../types/chat';

type MessageReactionRow = {
  message_id: string;
  user_id: number;
  reaction_type: string;
};

type ChatMessageSelectRow = {
  id: string | number;
  telegram_id: number;
  room_id: string;
  username: string;
  content: string;
  created_at: string;
  reply_to_id?: string | null;
  // Supabase join shape can vary: one-to-one may still come back as an array depending on relation config.
  reply_message?: ChatMessageSelectRow | ChatMessageSelectRow[] | null;
  message_reactions?: MessageReactionRow[] | null;
};

const MESSAGE_SELECT =
  'id, telegram_id, room_id, username, content, created_at, reply_to_id, reply_message:reply_to_id(id, telegram_id, room_id, username, content, created_at), message_reactions(user_id, reaction_type, message_id)';

function normalizeMessageBase(row: ChatMessageSelectRow): Message {
  return {
    id: String(row.id),
    telegram_id: row.telegram_id,
    room_id: row.room_id,
    username: row.username,
    content: row.content,
    created_at: row.created_at,
    reply_to_id: row.reply_to_id ?? null,
    reply_message: null,
    reactions: { like_count: 0, user_has_liked: false },
  };
}

function normalizeMessage(row: ChatMessageSelectRow, currentUserId: number | null): Message {
  const m = normalizeMessageBase(row);

  const replyRaw = row.reply_message ?? null;
  const reply = Array.isArray(replyRaw) ? (replyRaw[0] ?? null) : replyRaw;
  if (reply) {
    m.reply_message = {
      ...normalizeMessageBase(reply),
      reply_to_id: null,
      reply_message: null,
      reactions: undefined,
    };
  } else {
    m.reply_message = null;
  }

  const reactions = row.message_reactions ?? [];
  const likes = reactions.filter((r) => r?.reaction_type === 'like');
  m.reactions = {
    like_count: likes.length,
    user_has_liked: typeof currentUserId === 'number' ? likes.some((r) => r.user_id === currentUserId) : false,
  };

  return m;
}

function formatReplyPreview(content: string) {
  const oneLine = (content ?? '').replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 80) return oneLine;
  return `${oneLine.slice(0, 77)}...`;
}

export default function ChatRoom(props: {
  roomId?: string;
  userId: number | null;
  username: string | null;
  onBack: () => void;
}) {
  const { userId, username, onBack, roomId = 'global' } = props;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(new Set());

  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const swipeRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    triggered: boolean;
    messageId: string | null;
  }>({ pointerId: null, startX: 0, startY: 0, triggered: false, messageId: null });

  // Dev-only fallback identity so local browser testing can send messages even outside Telegram.
  const devFallbackIdentity =
    import.meta.env.DEV && (typeof userId !== 'number' || !username || username.trim().length === 0)
      ? { userId: 88888888, username: 'dev_testing' }
      : null;

  const effectiveUserId = devFallbackIdentity?.userId ?? userId;
  const effectiveUsername = (devFallbackIdentity?.username ?? username ?? '').trim();
  const currentUserIdForReactions = typeof effectiveUserId === 'number' ? effectiveUserId : null;

  const canSend = useMemo(() => {
    return (
      typeof effectiveUserId === 'number' &&
      Number.isFinite(effectiveUserId) &&
      effectiveUserId > 0 &&
      typeof effectiveUsername === 'string' &&
      effectiveUsername.trim().length > 0 &&
      input.trim().length > 0 &&
      !isSending
    );
  }, [effectiveUserId, effectiveUsername, input, isSending]);

  const scrollToBottom = () => {
    try {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore
    }
  };

  const focusComposer = () => {
    try {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore
    }
    try {
      inputRef.current?.focus();
    } catch {
      // ignore
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    // Ensure the preview bar is rendered, then scroll + focus for best UX.
    queueMicrotask(focusComposer);
  };

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  useEffect(() => {
    setReplyingTo(null);
  }, [roomId]);

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let cancelled = false;

    const fetchMessageById = async (messageId: string): Promise<Message | null> => {
      const { data, error } = await sb.from('chat_messages').select(MESSAGE_SELECT).eq('id', messageId).single();
      if (error) {
        console.warn('[ChatRoom] Failed to load message by id:', messageId, error);
        return null;
      }
      return normalizeMessage(data as unknown as ChatMessageSelectRow, currentUserIdForReactions);
    };

    const loadHistory = async () => {
      const { data, error } = await sb
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        console.error('[ChatRoom] Failed to load chat history:', error);
        return;
      }

      const rows = (data ?? []) as ChatMessageSelectRow[];
      const normalized = rows.map((r) => normalizeMessage(r, currentUserIdForReactions));
      normalized.reverse(); // show oldest -> newest
      setMessages(normalized);
      queueMicrotask(scrollToBottom);
    };

    void loadHistory();

    const channel = sb
      .channel(`chat-messages-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const rawId = payload?.new?.id;
          if (!rawId) return;
          const id = String(rawId);

          void fetchMessageById(id).then((full) => {
            if (cancelled) return;
            if (!full) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === full.id)) return prev;
              return [...prev, full];
            });
            queueMicrotask(scrollToBottom);
          });
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
  }, [roomId, currentUserIdForReactions]);

  const refreshReactionsForMessage = async (messageId: string) => {
    const sb = supabase;
    if (!sb) return;

    const { data, error } = await sb
      .from('message_reactions')
      .select('user_id, reaction_type', { count: 'exact' })
      .eq('message_id', messageId)
      .eq('reaction_type', 'like');

    if (error) {
      console.warn('[ChatRoom] Failed to refresh reactions:', error);
      return;
    }

    const userIds = (data ?? []).map((r: any) => r?.user_id).filter((v: any) => typeof v === 'number') as number[];
    const likeCount = typeof (data as any)?.length === 'number' ? (data as any).length : userIds.length;
    const hasLiked =
      typeof effectiveUserId === 'number' && Number.isFinite(effectiveUserId) && effectiveUserId > 0
        ? userIds.includes(effectiveUserId)
        : false;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: { like_count: likeCount, user_has_liked: hasLiked },
            }
          : m
      )
    );
  };

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    let cancelled = false;

    const channel = sb
      .channel(`message-reactions-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload: any) => {
        if (cancelled) return;
        const messageId = String(payload?.new?.message_id ?? payload?.old?.message_id ?? '');
        const reactionType = String(payload?.new?.reaction_type ?? payload?.old?.reaction_type ?? '');
        if (!messageId) return;
        if (reactionType && reactionType !== 'like') return;
        if (!messageIdsRef.current.has(messageId)) return;
        void refreshReactionsForMessage(messageId);
      })
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

  const toggleLike = async (message: Message) => {
    const sb = supabase;
    if (!sb) return;

    const uid = effectiveUserId;
    if (typeof uid !== 'number' || !Number.isFinite(uid) || uid <= 0) return;

    const messageId = message.id;
    if (!messageId) return;
    if (likePendingIds.has(messageId)) return;

    setLikePendingIds((prev) => new Set(prev).add(messageId));

    const hadLiked = Boolean(message.reactions?.user_has_liked);
    const prevLikeCount = Math.max(0, message.reactions?.like_count ?? 0);

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: {
                like_count: hadLiked ? Math.max(0, prevLikeCount - 1) : prevLikeCount + 1,
                user_has_liked: !hadLiked,
              },
            }
          : m
      )
    );

    try {
      if (!hadLiked) {
        const { error } = await sb
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: uid, reaction_type: 'like' });
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', uid)
          .eq('reaction_type', 'like');
        if (error) throw error;
      }
    } catch (e) {
      console.warn('[ChatRoom] toggleLike failed, reverting:', e);
      // Rollback by reloading current counts
      await refreshReactionsForMessage(messageId);
    } finally {
      setLikePendingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      // Ensure count is accurate in case of race/unique constraint
      await refreshReactionsForMessage(messageId);
    }
  };

  const handleSend = async () => {
    const sb = supabase;
    if (!sb) return;

    const uid = effectiveUserId;
    const uname = effectiveUsername;
    const content = input.trim();

    if (typeof uid !== 'number' || !Number.isFinite(uid) || uid <= 0) {
      return;
    }
    if (!uname) {
      return;
    }
    if (!content) {
      return;
    }
    if (isSending) {
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await sb
        .from('chat_messages')
        .insert({ telegram_id: uid, room_id: roomId, username: uname, content, reply_to_id: replyingTo?.id ?? null })
        .select(MESSAGE_SELECT)
        .single();

      if (error) {
        console.error('[ChatRoom] Send failed:', error);
        return;
      }

      const row = data as unknown as ChatMessageSelectRow;
      const normalized = normalizeMessage(row, currentUserIdForReactions);
      setInput('');
      setReplyingTo(null);
      setMessages((prev) => {
        if (prev.some((m) => m.id === normalized.id)) return prev;
        return [...prev, normalized];
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

  const isMine = (m: Message) => typeof effectiveUserId === 'number' && m.telegram_id === effectiveUserId;

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
        {supabase &&
          !devFallbackIdentity &&
          (typeof userId !== 'number' || !username || username.trim().length === 0) && (
            <div className="text-xs text-gray-400 border border-white/10 bg-black/20 rounded-xl px-3 py-2">
              Sending is disabled because no chat identity was found. Open inside Telegram to send messages.
            </div>
          )}

        {messages.map((m) => {
          const mine = isMine(m);
          const liked = Boolean(m.reactions?.user_has_liked);
          const likeCount = Math.max(0, m.reactions?.like_count ?? 0);
          const likePending = likePendingIds.has(m.id);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 border ${
                  mine
                    ? 'bg-neon-green/15 border-neon-green/30'
                    : 'bg-surface/60 border-white/10'
                }`}
                style={{ touchAction: 'pan-y' }}
                onPointerDown={(e) => {
                  // Right-swipe to reply (touch or mouse drag)
                  swipeRef.current.pointerId = e.pointerId;
                  swipeRef.current.startX = e.clientX;
                  swipeRef.current.startY = e.clientY;
                  swipeRef.current.triggered = false;
                  swipeRef.current.messageId = m.id;
                  try {
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }}
                onPointerMove={(e) => {
                  if (swipeRef.current.pointerId !== e.pointerId) return;
                  if (swipeRef.current.triggered) return;
                  if (swipeRef.current.messageId !== m.id) return;

                  const dx = e.clientX - swipeRef.current.startX;
                  const dy = e.clientY - swipeRef.current.startY;

                  // Intent: horizontal swipe right, not vertical scroll
                  if (dx > 56 && Math.abs(dy) < 24) {
                    swipeRef.current.triggered = true;
                    handleReply(m);
                  }
                }}
                onPointerUp={(e) => {
                  if (swipeRef.current.pointerId !== e.pointerId) return;
                  swipeRef.current.pointerId = null;
                  swipeRef.current.messageId = null;
                  swipeRef.current.triggered = false;
                }}
                onPointerCancel={(e) => {
                  if (swipeRef.current.pointerId !== e.pointerId) return;
                  swipeRef.current.pointerId = null;
                  swipeRef.current.messageId = null;
                  swipeRef.current.triggered = false;
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`text-xs font-semibold ${mine ? 'text-neon-green' : 'text-gray-300'}`}>
                    {m.username || 'Anonymous'}
                  </span>
                  <span className="text-[10px] text-gray-500">{formatTime(m.created_at)}</span>
                </div>
                {m.reply_to_id && (
                  <div className="mb-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">
                      Replying to{' '}
                      <span className="text-neon-gold font-semibold">
                        {m.reply_message?.username || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-300/90 whitespace-pre-wrap break-words max-h-10 overflow-hidden">
                      {m.reply_message?.content
                        ? formatReplyPreview(m.reply_message.content)
                        : 'Original message unavailable'}
                    </div>
                  </div>
                )}
                <div className="text-sm text-white whitespace-pre-wrap break-words">{m.content}</div>

                <div className={`mt-2 flex items-center gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  <button
                    onClick={() => handleReply(m)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-neon-gold transition-colors"
                    aria-label="Reply"
                    title="Reply"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() => void toggleLike(m)}
                    disabled={!supabase || likePending || typeof effectiveUserId !== 'number'}
                    className={`inline-flex items-center gap-1.5 text-[11px] transition-colors ${
                      liked ? 'text-neon-gold' : 'text-gray-400 hover:text-neon-gold'
                    } ${!devFallbackIdentity && (!supabase || typeof userId !== 'number') ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-label="Like"
                    title={liked ? 'Unlike' : 'Like'}
                  >
                    <Heart className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} />
                    <span className="font-semibold">{likeCount}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        ref={composerRef}
        className="px-4 pb-5 pt-3 border-t border-white/10 bg-surface/80 backdrop-blur-md"
      >
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-neon-gold/25 bg-black/30 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-neon-gold">
                Replying to {replyingTo.username || 'Anonymous'}
              </div>
              <div className="text-[11px] text-gray-400 truncate">{formatReplyPreview(replyingTo.content)}</div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4 text-gray-300" />
            </button>
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


