// src/services/geniusApi.ts
// Serviço para comunicação com Edge Functions do Genius

import { supabase } from '../lib/supabase';

export interface CreateGeniusTaskParams {
  prompt: string;
  files?: Array<{
    filename: string;
    content: string; // base64
    size_bytes: number;
    mime_type: string;
  }>;
  conversationId: string;
}

export interface CreateGeniusTaskResponse {
  success: boolean;
  task_id: string;
  trace_id: string;
  status: string;
  estimated_time_seconds?: number;
  error?: string;
  message?: string;
  retryable?: boolean;
}

export interface ContinueGeniusTaskParams {
  taskId: string;
  userResponse: string;
}

export interface RegisterWebhookResponse {
  success: boolean;
  webhook_id?: string;
  webhook_url?: string;
  status: string;
  error?: string;
  instructions?: string;
}

export class GeniusApiService {
  /**
   * Criar tarefa no Manus
   */
  static async createTask(
    params: CreateGeniusTaskParams
  ): Promise<CreateGeniusTaskResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('genius-create-task', {
        body: {
          prompt: params.prompt,
          files: params.files,
          conversation_id: params.conversationId,
        },
      });

      if (error) {
        console.error('[GeniusApi] createTask error:', error);
        return {
          success: false,
          task_id: '',
          trace_id: '',
          status: 'error',
          error: error.message || 'Failed to create task',
          retryable: true,
        };
      }

      return data as CreateGeniusTaskResponse;
    } catch (error) {
      console.error('[GeniusApi] createTask exception:', error);
      return {
        success: false,
        task_id: '',
        trace_id: '',
        status: 'error',
        error: String(error),
        retryable: true,
      };
    }
  }

  /**
   * Continuar tarefa quando stop_reason = ask
   */
  static async continueTask(
    params: ContinueGeniusTaskParams
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('genius-continue-task', {
        body: {
          task_id: params.taskId,
          user_response: params.userResponse,
        },
      });

      if (error) {
        console.error('[GeniusApi] continueTask error:', error);
        return {
          success: false,
          error: error.message || 'Failed to continue task',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[GeniusApi] continueTask exception:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Registrar webhook automaticamente
   */
  static async registerWebhook(): Promise<RegisterWebhookResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('genius-register-webhook', {
        body: {},
      });

      if (error) {
        console.error('[GeniusApi] registerWebhook error:', error);
        return {
          success: false,
          status: 'error',
          error: error.message || 'Failed to register webhook',
        };
      }

      return data as RegisterWebhookResponse;
    } catch (error) {
      console.error('[GeniusApi] registerWebhook exception:', error);
      return {
        success: false,
        status: 'error',
        error: String(error),
      };
    }
  }

  /**
   * Sincronizar créditos (opcional)
   */
  static async syncCreditUsage(taskId: string): Promise<{ success: boolean; credit_usage?: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('genius-sync-credit', {
        body: { task_id: taskId },
      });

      if (error) {
        console.error('[GeniusApi] syncCreditUsage error:', error);
        return { success: false };
      }

      return { success: true, credit_usage: data?.credit_usage };
    } catch (error) {
      console.error('[GeniusApi] syncCreditUsage exception:', error);
      return { success: false };
    }
  }
}
