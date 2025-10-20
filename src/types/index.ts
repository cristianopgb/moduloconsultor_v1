// /src/types/index.ts
export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
};

export type TemplateModel = {
  id: string;
  name: string;
  description?: string | null;
  html_variables?: any | null;
};
