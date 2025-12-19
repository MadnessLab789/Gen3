/**
 * ChatMessage 接口定义
 * 严格对应 Supabase chat_history 表结构，用于适配 n8n V5.2 后端
 */
export interface ChatMessage {
  id: string; // uuid
  match_id: number | null; // 关联比赛ID (如果为空则是全局消息)

  // 发送者信息
  user_id?: string | null; // 真实用户的 Supabase UUID (AI Agent 此项为空)
  persona_name: string; // 显示名称 (AI Agent 的名字 或 用户的 username)
  avatar_url?: string; // 头像链接

  // V5.2 AI 核心字段
  persona_role?: 'Ultra' | 'Analyst' | 'TheMat' | 'TheKaki' | 'TheBoomer' | 'Casual' | null; // 角色类型，用于控制气泡样式
  content: string; // 消息内容
  mood_score?: number; // 情绪分 (绝对值 > 8 时触发特效)
  like_count: number; // 点赞数

  created_at: string; // ISO 时间戳
}

