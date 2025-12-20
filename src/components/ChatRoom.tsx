import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Heart, Send, Users, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import type { ChatMessage } from '../types/index';

interface ChatRoomProps {
  /**
   * 比赛 ID（可选）
   * - 如果有值：War Room 模式，查询 chat_history 表中 match_id = matchId 的消息
   * - 如果未提供：Global Chat 模式，查询 chat_history 表中 match_id IS NULL 的消息
   * 
   * ⚠️ 重要：此处的 matchId 必须对应数据库 chat_history 表的 match_id 字段
   * 虽然外部数据源（如 n8n）可能使用 fixture_id，但数据库字段名是 match_id
   */
  matchId?: number;
  currentUser: { id: number; username: string };
  onBack: () => void;
  onNavigateToWarRoom?: (matchId: number) => void; // 可选：导航到 War Room 的回调
}

const HISTORY_LIMIT = 50;

// V5.2: 检查是否是真实用户消息
const isUserMessage = (message: ChatMessage, currentUserId: number): boolean => {
  // 真实用户消息：有 user_id 且等于 currentUser.id，且 persona_role 为 null
  return Boolean(message.user_id) && Number(message.user_id) === currentUserId && !message.persona_role;
};

// V5.2: 获取角色对应的 Verified Badge Emoji
const getRoleBadge = (role: string | null | undefined): string => {
  if (!role) return '';
  
  switch (role) {
    case 'Analyst':
      return '🛡️'; // 分析师：盾牌徽章
    case 'Ultra':
      return '🔥'; // 气氛组：火焰徽章
    case 'TheKaki':
      return '💬'; // TheKaki：对话徽章
    case 'TheMat':
      return '📊'; // TheMat：图表徽章
    case 'TheBoomer':
      return '👴'; // TheBoomer：老人徽章
    case 'Casual':
      return '😎'; // Casual：酷炫徽章
    default:
      return '';
  }
};

// V5.2: 获取气泡样式
const getBubbleStyle = (message: ChatMessage, isUser: boolean, isGlobalMode: boolean): string => {
  // 真实用户消息：保持简洁的蓝色背景，不使用 AI 特殊颜色
  if (isUser) {
    return 'bg-blue-500/20 border-blue-400/40 text-white';
  }

  // 官方通告：金色/深黑渐变（优先级最高）
  if (isGlobalMode && isOfficialAnnouncement(message)) {
    return 'bg-gradient-to-br from-neon-gold/30 via-yellow-600/20 to-black/40 border-neon-gold/50 text-white shadow-lg shadow-neon-gold/20';
  }

  const role = message.persona_role;

  // Global 模式：更温和的样式
  if (isGlobalMode) {
    if (role === 'Ultra') {
      // 大厅模式：温和的橙色
      return 'bg-gradient-to-br from-orange-500/15 to-amber-500/15 border-orange-400/30 text-white';
    }
    
    if (role === 'Analyst') {
      // 大厅模式：温和的蓝色，带蓝色描边
      return 'bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border-blue-400/30 text-gray-100';
    }
    
    if (role === 'TheKaki') {
      // TheKaki：绿色背景
      return 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-400/30 text-white';
    }
    
    // 其他角色或默认样式
    return 'bg-surface/60 border-white/10 text-white';
  }

  // War Room 模式：更激进的样式
  if (role === 'Ultra') {
    // Ultra：红色渐变背景
    return 'bg-gradient-to-br from-red-500/30 to-orange-500/30 border-red-400/50 text-white font-bold';
  }
  
  if (role === 'Analyst') {
    // Analyst：蓝色描边 + font-mono 字体
    return 'bg-gradient-to-br from-slate-800/90 to-blue-900/90 border-2 border-blue-500/60 text-gray-100 font-mono shadow-lg shadow-blue-500/20';
  }
  
  if (role === 'TheKaki') {
    // TheKaki：绿色背景
    return 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400/50 text-white';
  }
  
  // 其他角色或默认样式
  return 'bg-surface/60 border-white/10 text-white';
};

// 检测消息中是否包含关键词，返回对应的 CTA 类型
const detectCTA = (content: string): 'war-room' | 'vip' | null => {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('war room') || lowerContent.includes('warroom')) {
    return 'war-room';
  }
  if (lowerContent.includes('vip')) {
    return 'vip';
  }
  return null;
};

// 检测是否是官方通告消息（Global Chat 中的带货消息）
const isOfficialAnnouncement = (message: ChatMessage): boolean => {
  // 条件1: match_id 必须为 null（全局消息）
  // 条件2: persona_role 为 'Official' 或 persona_name 包含 'OddsFlow'/'Admin'
  return (
    message.match_id === null &&
    Boolean(message.persona_name) &&
    (message.persona_role === 'Official' ||
      message.persona_name.toLowerCase().includes('oddsflow') ||
      message.persona_name.toLowerCase().includes('admin'))
  );
};

// V5.2: 检查是否有极端情绪
const hasExtremeEmotion = (message: ChatMessage): boolean => {
  const score = message.mood_score;
  return score !== null && score !== undefined && (score > 8 || score < -8);
};

// 获取头像初始字母
const getInitial = (name: string): string => {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed[0]?.toUpperCase() ?? '?';
};

// 格式化时间
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatRoom({ matchId, currentUser, onBack, onNavigateToWarRoom }: ChatRoomProps) {
  const isGlobalMode = matchId === undefined || matchId === null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(450); // 在线人数模拟器
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(new Set());
  const [hotWarRoom, setHotWarRoom] = useState<{ matchId: number; title: string } | null>(null); // 热门 War Room

  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // 在线人数模拟器：400-500 随机波动
  useEffect(() => {
    const interval = setInterval(() => {
      const base = 450;
      const variation = Math.floor(Math.random() * 100) - 50; // -50 to +50
      setOnlineCount(Math.max(400, Math.min(500, base + variation)));
    }, 3000); // 每 3 秒更新一次

    return () => clearInterval(interval);
  }, []);

  // Global 模式：获取热门 War Room（从消息中提取或从数据库查询）
  useEffect(() => {
    if (!isGlobalMode) return;

    const sb = supabase;
    if (!sb) return;

    // 查询有 Signal 且最近活跃的 War Room
    // 从 chat_history 中查找包含 match_id 的消息，提取热门比赛
    const fetchHotWarRoom = async () => {
      try {
        // 查询最近有 match_id 的消息（说明有活跃的 War Room）
        const { data } = await sb
          .from('chat_history')
          .select('match_id, content')
          .not('match_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data && data.length > 0) {
          // 找到第一个有 match_id 的消息
          const messageWithMatch = data.find((m: any) => m.match_id);
          if (messageWithMatch && messageWithMatch.match_id) {
            // 简化：使用 match_id，实际应该查询 match 表获取完整信息
            setHotWarRoom({
              matchId: messageWithMatch.match_id,
              title: `🔥 Match #${messageWithMatch.match_id}: Signal Active!`,
            });
          }
        }
      } catch (err) {
        console.warn('[ChatRoom] Failed to fetch hot War Room:', err);
        // 失败时不显示热门 War Room
      }
    };

    void fetchHotWarRoom();
  }, [isGlobalMode]);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, []);

  // 加载历史消息
  const loadHistory = useCallback(async () => {
    const sb = supabase;
    if (!sb) {
      console.warn('[ChatRoom] Supabase client is null');
      return;
    }

    try {
      let query = sb
        .from('chat_history')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(HISTORY_LIMIT);

      // 根据 matchId 过滤（数据类型安全）
      // ⚠️ 关键：查询必须使用 chat_history 表的 match_id 字段（不是 fixture_id）
      if (matchId !== null && typeof matchId === 'number' && !isNaN(matchId)) {
        // War Room 模式：只加载该 match_id 的消息（match_id 必须是数字）
        // 注意：matchId prop 的值必须对应数据库 match_id 列的值
        query = query.eq('match_id', matchId);
      } else {
        // Global Chat 模式：加载 match_id 为 null 的全局消息
        query = query.is('match_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ChatRoom] Failed to load history:', error);
        return;
      }

      const rows = (data ?? []) as ChatMessage[];
      
      // 额外过滤：确保 Global Chat 只显示 match_id 为 null 的消息
      // War Room 只显示 match_id 匹配的消息
      const filteredRows = rows.filter((msg) => {
        if (matchId !== null && typeof matchId === 'number' && !isNaN(matchId)) {
          // War Room 模式：只显示 match_id 等于当前 matchId 的消息
          return msg.match_id === matchId;
        } else {
          // Global Chat 模式：只显示 match_id 为 null 的消息
          return msg.match_id === null;
        }
      });
      
      setMessages(filteredRows);
      scrollToBottom();
    } catch (err) {
      console.error('[ChatRoom] Load history error:', err);
    }
  }, [matchId, scrollToBottom]);

  // 实时订阅 chat_history 表
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    // 先加载历史消息
    void loadHistory();

    // 根据是否有 matchId 创建不同的频道（数据类型安全）
    if (matchId !== null && typeof matchId === 'number' && !isNaN(matchId)) {
      // War Room 模式：监听特定 match_id 的新消息
      // 确保 match_id 是数字类型，避免 NULL 值导致类型错误
      const channel = sb
        .channel(`realtime-match-${matchId}`)
        .on(
      'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_history',
            filter: `match_id=eq.${matchId}`, // ⚠️ 关键：实时订阅使用 match_id 字段（不是 fixture_id），仅接收当前 War Room 比赛的消息
          },
          (payload) => {
            // 当 n8n 写入新数据时，立即将其推入前端状态
            const newMessage = payload.new as ChatMessage;
            
            // 额外验证：确保消息的 match_id 匹配当前 matchId（War Room 模式）
            if (newMessage.match_id !== matchId) {
              console.warn('[ChatRoom] War Room received message with mismatched match_id, ignoring:', newMessage);
              return;
            }
            
            // 添加新消息到列表（去重）
          setMessages((prev) => {
              // 避免重复添加
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });

            // 自动滚动到底部
            scrollToBottom();
          }
        )
        .subscribe();

    return () => {
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
    } else {
      // Global 模式：监听 match_id 为 null 的全局消息
      const channel = sb
        .channel('realtime-global-chat')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_history',
            filter: 'match_id=is.null', // ⚠️ 关键：实时订阅使用 match_id 字段，仅接收全局消息（match_id 为 NULL）
          },
          (payload) => {
            const newMessage = payload.new as ChatMessage;

            // 额外验证：确保消息的 match_id 为 null（Global Chat 模式）
            if (newMessage.match_id !== null) {
              console.warn('[ChatRoom] Global Chat received message with non-null match_id, ignoring:', newMessage);
      return;
    }

            // 添加新消息到列表（去重）
            setMessages((prev) => {
              // 避免重复添加
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });

            // 自动滚动到底部
            scrollToBottom();
          }
        )
      .subscribe();

    return () => {
      try {
        sb.removeChannel(channel);
      } catch {
        // ignore
      }
    };
    }
  }, [matchId, loadHistory, scrollToBottom]);

  // 发送消息
  const handleSend = useCallback(async () => {
    const sb = supabase;
    if (!sb) return;

    const content = input.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    try {
      // 真实用户发送时，persona_role 设为 null，persona_name 使用 currentUser.username
      // 确保 Global Chat 模式下 match_id 明确设置为 null
      const messageData: any = {
        user_id: String(currentUser.id), // 转换为 string (Supabase UUID)
        persona_name: currentUser.username,
        persona_role: null, // 真实用户消息，persona_role 为 null
        content,
        like_count: 0,
      };

      // ⚠️ 关键：插入消息时必须使用 match_id 字段名（不是 fixture_id）
      // War Room 模式：设置 match_id（必须是数字，对应数据库 match_id 列）
      // Global Chat 模式：match_id 必须为 null
      if (matchId !== null && typeof matchId === 'number' && !isNaN(matchId)) {
        messageData.match_id = matchId; // matchId prop 的值直接映射到数据库 match_id 字段
      } else {
        // Global Chat：明确设置为 null
        messageData.match_id = null;
      }

      const { error } = await sb.from('chat_history').insert(messageData);

      if (error) {
        console.error('[ChatRoom] Send failed:', error);
        return;
      }

      // 清空输入框
      setInput('');

      // 消息会通过实时订阅自动添加到列表
      scrollToBottom();
    } catch (err) {
      console.error('[ChatRoom] Send error:', err);
    } finally {
      setIsSending(false);
    }
  }, [input, matchId, currentUser, isSending, scrollToBottom]);

  // 乐观点赞：点击后本地数字立马 +1，后台异步调用 RPC 更新
  const handleLike = useCallback(
    async (message: ChatMessage) => {
      const sb = supabase;
      if (!sb) return;

      const messageId = message.id;
      if (likePendingIds.has(messageId)) return;

      const currentLikeCount = message.like_count ?? 0;
      const newLikeCount = currentLikeCount + 1;

      // 乐观更新：立即更新 UI
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, like_count: newLikeCount } : m))
      );

      setLikePendingIds((prev) => new Set(prev).add(messageId));

      try {
        // 后台异步调用 RPC 更新（假设有 increment_like_count RPC）
        const { error } = await sb.rpc('increment_like_count', {
          message_id: messageId,
        });

        // 如果 RPC 不存在，使用直接更新
        if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
          const { error: updateError } = await sb
            .from('chat_history')
            .update({ like_count: newLikeCount })
            .eq('id', messageId);

          if (updateError) {
            throw updateError;
          }
        } else if (error) {
          throw error;
        }
      } catch (err) {
        console.error('[ChatRoom] Like failed, reverting:', err);
        // 回滚乐观更新
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, like_count: currentLikeCount } : m))
        );
      } finally {
        setLikePendingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [likePendingIds]
  );

  return (
    <div className="min-h-screen bg-background text-white max-w-md mx-auto relative font-sans flex flex-col">
      {/* Header: Live Chat + Online Users */}
      <div className="px-4 pt-6 pb-4 border-b border-white/10 bg-surface/60 backdrop-blur-md">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
            <div className="text-lg font-black text-neon-gold">
              {isGlobalMode ? 'Global Chat' : 'Live Chat'}
            </div>
          </div>
          {/* 在线人数模拟器 */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Users className="w-4 h-4" />
            <span className="font-mono">{onlineCount}</span>
            <span className="text-[10px]">Online</span>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!supabase && (
          <div className="text-sm text-gray-400">
            Supabase is not configured. Please set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
          </div>
        )}

        {/* Global 模式：置顶/公告区域 - 热门 War Room */}
        {isGlobalMode && (
          <AnimatePresence>
            {hotWarRoom && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-4 rounded-xl bg-gradient-to-r from-neon-gold/20 to-orange-500/20 border border-neon-gold/40 p-3 cursor-pointer hover:from-neon-gold/30 hover:to-orange-500/30 transition-all"
                onClick={() => {
                  if (onNavigateToWarRoom) {
                    onNavigateToWarRoom(hotWarRoom.matchId);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-neon-gold">{hotWarRoom.title}</span>
            </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <AnimatePresence>
          {messages.map((message, index) => {
            const isUser = isUserMessage(message, currentUser.id);
            const isOfficial = isGlobalMode && isOfficialAnnouncement(message);
            const bubbleStyle = getBubbleStyle(message, isUser, isGlobalMode);
            const extremeEmotion = hasExtremeEmotion(message);
            const likeCount = message.like_count ?? 0;
            const isLikePending = likePendingIds.has(message.id);
            const displayName = message.persona_name || 'Anonymous';
            const ctaType = isGlobalMode ? detectCTA(message.content) : null; // 只在 Global 模式检测 CTA
            const hasWarRoomMention = isOfficial && (message.content.toLowerCase().includes('war room') || message.content.toLowerCase().includes('warroom'));

          // 获取角色徽章
          const roleBadge = getRoleBadge(message.persona_role);
          
          // Mood Score Animation: 如果 |mood_score| > 8，增加动画效果
          const hasExtremeMood = extremeEmotion;
          const moodAnimationProps = hasExtremeMood
            ? {
                animate: {
                  scale: [1, 1.02, 1],
                },
                transition: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut' as const,
                },
              }
            : {};

          return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 overflow-hidden border ${
                      isUser
                        ? 'border-blue-400/30 bg-blue-500/10'
                        : isOfficial
                          ? 'border-neon-gold/50 bg-gradient-to-br from-neon-gold/20 to-yellow-600/10 shadow-md shadow-neon-gold/30'
                          : 'border-neon-gold/30 bg-neon-purple/20'
                  } flex items-center justify-center text-xs font-black text-white`}
                >
                    {message.avatar_url ? (
                    <img
                        src={message.avatar_url}
                        alt={displayName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                      <span className="select-none">{getInitial(displayName)}</span>
                  )}
                </div>

                  {/* Message Bubble */}
                  <motion.div
                    {...moodAnimationProps}
                    className={`rounded-2xl px-4 py-3 border ${bubbleStyle} ${
                      hasExtremeMood ? 'drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]' : ''
                    } ${isOfficial && hasWarRoomMention ? 'cursor-pointer hover:shadow-xl hover:shadow-neon-gold/30 transition-all' : ''}`}
                    onClick={() => {
                      // 官方通告点击交互：如果提到 War Room，跳转到首页或显示 Toast
                      if (isOfficial && hasWarRoomMention) {
                        // 显示 Toast 提示
                        const toast = document.createElement('div');
                        toast.className =
                          'fixed top-4 left-1/2 -translate-x-1/2 bg-neon-gold text-black px-4 py-2 rounded-lg shadow-lg z-50 font-bold text-sm';
                        toast.textContent = 'Go to Home to find this match!';
                        document.body.appendChild(toast);
                        
                        setTimeout(() => {
                          toast.style.opacity = '0';
                          toast.style.transition = 'opacity 0.3s';
                          setTimeout(() => {
                            document.body.removeChild(toast);
                          }, 300);
                        }, 2000);
                        
                        // 可选：延迟后跳转到首页
                        setTimeout(() => {
                          onBack();
                        }, 2500);
                      }
                    }}
                  >
                    {/* Header: Name and Time */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        {/* 官方通告图标 */}
                        {isOfficial && (
                          <span className="text-base">📢</span>
                        )}
                        {/* Verified Badge: 根据 persona_role 显示对应的 Emoji 徽章 */}
                        {!isOfficial && !isUser && roleBadge && (
                          <span className="text-sm" title={`${message.persona_role} Agent`}>
                            {roleBadge}
                    </span>
                        )}
                        {/* Ultra 火焰图标（如果没有使用徽章） */}
                        {!isOfficial && !isUser && !roleBadge && message.persona_role === 'Ultra' && (
                          <Flame className="w-4 h-4 text-orange-500" />
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            isUser
                              ? 'text-blue-300'
                              : isOfficial
                                ? 'text-neon-gold font-bold'
                                : message.persona_role === 'Analyst'
                                  ? 'text-blue-300 font-mono'
                                  : 'text-gray-300'
                          }`}
                        >
                          {displayName}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{formatTime(message.created_at)}</span>
                      </div>

                    {/* Content */}
                    <div
                      className={`text-sm whitespace-pre-wrap break-words ${
                        extremeEmotion ? 'font-bold' : ''
                      } ${
                        message.persona_role === 'Analyst' ? 'font-mono' : ''
                      }`}
                    >
                      {message.content}
                    </div>

                    {/* CTA Button (Global 模式：检测关键词) */}
                    {isGlobalMode && ctaType && !isUser && (
                      <div className="mt-2">
                    <button
                          onClick={() => {
                            if (ctaType === 'war-room' && onNavigateToWarRoom) {
                              // 尝试从消息中提取 match_id，或使用默认值
                              const matchIdFromMessage = message.match_id;
                              if (matchIdFromMessage) {
                                onNavigateToWarRoom(matchIdFromMessage);
                              }
                            } else if (ctaType === 'vip') {
                              // VIP 相关操作（可以触发 VIP 购买流程）
                              // 这里可以触发一个自定义事件或调用回调
                              window.dispatchEvent(new CustomEvent('open-vip-modal'));
                            }
                          }}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                            ctaType === 'war-room'
                              ? 'bg-gradient-to-r from-neon-gold to-orange-500 text-black hover:shadow-lg hover:shadow-neon-gold/50'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50'
                          }`}
                        >
                          {ctaType === 'war-room' ? '🚀 Check War Room' : '💎 Get VIP'}
                    </button>
                      </div>
                    )}

                    {/* Like Button (only for non-user messages) */}
                    {!isUser && (
                      <div className="mt-2 flex items-center gap-2">
                    <button
                          onClick={() => void handleLike(message)}
                          disabled={isLikePending || !supabase}
                      className={`inline-flex items-center gap-1.5 text-[11px] transition-colors ${
                            likeCount > 0 ? 'text-neon-gold' : 'text-gray-400 hover:text-neon-gold'
                          } ${isLikePending ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label="Like"
                    >
                          <Heart
                            className={`w-4 h-4 ${extremeEmotion ? 'animate-bounce' : ''}`}
                            fill={likeCount > 0 ? 'currentColor' : 'none'}
                          />
                      <span className="font-semibold">{likeCount}</span>
                    </button>
                  </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
          );
        })}
        </AnimatePresence>

        <div ref={endRef} />
      </div>

      {/* Input Composer */}
      <div className="px-4 pb-5 pt-3 border-t border-white/10 bg-surface/80 backdrop-blur-md">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-surface-highlight border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-gold/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={!supabase || isSending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!supabase || isSending || !input.trim()}
            className={`p-2 rounded-lg transition-all ${
              input.trim()
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
