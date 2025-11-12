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

export type ChatMode = 'analytics' | 'presentation' | 'consultor' | 'genius'

export interface Conversation {
  id: string
  user_id: string
  project_id?: string
  title: string
  chat_mode: ChatMode
  created_at: string
  updated_at: string
}

export type MessageType = 'text' | 'analysis_result' | 'presentation' | 'genius_task' | 'genius_result' | 'genius_error'

export interface Message {
  id: string
  conversation_id: string
  content: string
  role: 'user' | 'assistant'
  message_type: MessageType
  analysis_id?: string
  template_used_id?: string
  external_task_id?: string
  genius_status?: string
  genius_attachments?: GeniusAttachment[]
  genius_credit_usage?: number
  trace_id?: string
  created_at: string
}

export interface GeniusAttachment {
  file_name: string
  url: string
  size_bytes: number
  mime_type: string
  expires_at?: string
}

export type GeniusStatus = 'pending' | 'running' | 'completed' | 'failed'
export type GeniusStopReason = 'finish' | 'ask' | 'timeout'

export interface GeniusTask {
  id: string
  conversation_id: string
  user_id: string
  task_id: string
  trace_id: string
  prompt: string
  status: GeniusStatus
  stop_reason?: GeniusStopReason
  attachments?: GeniusAttachment[]
  task_url?: string
  credit_usage: number
  error_message?: string
  latency_ms?: number
  file_count: number
  total_size_bytes: number
  created_at: string
  updated_at: string
}

export const GENIUS_CONFIG = {
  MAX_FILES: 5,
  MAX_FILE_SIZE_MB: 25,
  MAX_TOTAL_SIZE_MB: 100,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  BLOCKED_EXTENSIONS: ['.exe', '.dll', '.sh', '.bat', '.cmd', '.ps1', '.zip', '.rar', '.7z', '.tar', '.gz'],
  BLOCKED_MIME_TYPES: [
    'application/x-msdownload',
    'application/x-executable',
    'application/x-sh',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-word.document.macroEnabled.12'
  ]
} as const
