export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  first_message?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  expression?: string;
  result?: string;
  steps?: string;
  imageUrl?: string;
  timestamp?: string;
}

export interface SessionMessage extends Message {
  session_id: string;
  user_id: string;
}
