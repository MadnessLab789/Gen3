export type MessageReactionsStats = {
  like_count: number;
  user_has_liked: boolean;
};

export interface Message {
  id: string;
  telegram_id: number;
  room_id: string;
  username: string;
  content: string;
  created_at: string;
  avatar_url?: string | null;

  reply_to_id?: string | null;
  reply_message?: Message | null;

  reactions?: MessageReactionsStats;

  // V5.2 Social Features
  persona_name?: string | null;
  persona_role?: string | null; // e.g., 'Ultra', 'Analyst', 'TheMat'
  mood_score?: number | null; // -10 to 10, where |mood_score| > 8 indicates extreme emotion
  match_id?: number | null; // Filter messages by match
}


