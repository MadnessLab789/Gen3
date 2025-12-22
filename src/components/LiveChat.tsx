import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';

type UiMessage = {
  id: string;
  fixture_id: number;
  content: string;
  created_at: string;
  username: string;
  user_id: number | null;
  avatar_url?: string | null;
  is_bot: boolean;
};

function normalizeLiveRow(row: any, fixtureId: number): UiMessage | null {
  const rowFixtureId = Number(row?.fixture_id);
  if (!Number.isFinite(rowFixtureId) || rowFixtureId !== fixtureId) return null;

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
    fixture_id: rowFixtureId,
    content,
    created_at,
    username,
    user_id,
    avatar_url: row?.avatar_url ?? null,
    is_bot,
  };
}

export default function LiveChat(props: {
  fixtureId: number;
  currentUser: { id: number; username: string };
  onBack: () => void;
}) {
  const { fixtureId, currentUser, onBack } = props;
  const fixtureIdNum = Number(fixtureId);
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
    if (!Number.isFinite(fixtureIdNum) || fixtureIdNum <= 0) {
      setMessages([]);
      return;
    }

    let isCancelled = false;
    const thisRequestFixtureId = fixtureIdNum;

    const load = async () => {
      const { data, error } = await sb
        .from('live_messages')
        .select('*')
        .eq('fixture_id', thisRequestFixtureId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (isCancelled) return;
      if (error) {
        console.error('[LiveChat] load failed:', error);
        setMessages([]);
        return;
      }

      const normalized = (data ?? [])
        .map((r) => normalizeLiveRow(r, thisRequestFixtureId))
        .filter(Boolean) as UiMessage[];
      setMessages(normalized);
      queueMicrotask(scrollToBottom);
    };

    void load();

    const channel = sb
      .channel(`realtime-live-messages-${thisRequestFixtureId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `fixture_id=eq.${thisRequestFixtureId}`,
        },
        (payload) => {
          if (isCancelled) return;
          const msg = normalizeLiveRow(payload.new as any, thisRequestFixtureId);
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
  }, [sb, fixtureIdNum]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !sb || sending) return;
    if (!Number.isFinite(fixtureIdNum) || fixtureIdNum <= 0) return;

    setSending(true);
    try {
      const payload = {
        fixture_id: fixtureIdNum,
        content,
        username: currentUser.username,
        user_id: currentUser.id,
        is_bot: false,
      };

      const { data, error } = await sb.from('live_messages').insert(payload as any).select('*').single();
      if (error) {
        console.error('[LiveChat] send failed:', error);
        return;
      }

      const msg = normalizeLiveRow(data as any, fixtureIdNum);
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
    <div className="bg-black/20 border border-white/10 rounded-xl p-3">
      <header className="flex items-center gap-3 mb-3">
        <button onClick={onBack} className="p-2 hover:bg-surface-highlight rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex-1">
          <div className="text-xs text-gray-400 font-mono">LIVE CHAT</div>
        </div>
      </header>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
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

      <div className="flex gap-2 mt-3">
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
          disabled={!sb || sending || !text.trim() || !Number.isFinite(fixtureIdNum)}
          title="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}


