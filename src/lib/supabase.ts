// /src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'proceidaia.auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Expor supabase no window para debug no console
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase
  console.log('✅ Cliente Supabase disponível no console via window.supabase')
}

export type UserRole = 'user' | 'master'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  tokens_used: number
  tokens_limit: number
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  title: string
  description: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  user_id: string
  title: string
  type: string
  file_url: string
  created_at: string
  updated_at: string
}

export type TemplateType = 'presentation' | 'analytics'

export interface Model {
  id: string
  name: string
  category: string
  file_type?: string
  file_url?: string
  content_html?: string
  template_content?: string
  description?: string
  tags?: string[]
  tags_detectadas?: string[]
  preview_image_url?: string
  template_json?: Record<string, any>
  template_type: TemplateType
  sql_template?: string
  required_columns?: Record<string, any>
  semantic_tags?: string[]
  created_at: string
  updated_at: string
}

export interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'local'
  api_key: string
  models: string[]
  active: boolean
  status: 'connected' | 'error' | 'testing'
  created_at: string
  updated_at: string
}

export interface AIAgent {
  id: string
  name: string
  description: string
  function_name: string
  prompt: string
  model: string
  provider_id: string
  tools: string[]
  active: boolean
  usage_count: number
  test_input?: string
  created_at: string
  updated_at: string
}

export type ChatMode = 'analytics' | 'presentation' | 'consultor'

export interface Conversation {
  id: string
  user_id: string
  project_id?: string
  title: string
  chat_mode: ChatMode
  created_at: string
  updated_at: string
}

export type MessageType = 'text' | 'analysis_result' | 'presentation'

export interface Message {
  id: string
  conversation_id: string
  content: string
  role: 'user' | 'assistant'
  message_type: MessageType
  analysis_id?: string
  template_used_id?: string
  created_at: string
}
