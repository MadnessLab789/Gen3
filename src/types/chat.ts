export interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id?: number | null;
  sender_type?: 'user' | 'bot' | null;
  nickname?: string | null;
  avatar_url?: string | null;
}


