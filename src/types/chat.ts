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
}


