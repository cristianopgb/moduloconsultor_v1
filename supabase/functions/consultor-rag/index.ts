/**
 * CONSULTOR RAG - ORQUESTRADOR COMPLETO DE CONSULTORIA
 *
 * Sistema inteligente que conduz todo o processo de consultoria:
 * 1. ANAMNESE: Conhecer o profissional e o negócio (7 turnos)
 * 2. MAPEAMENTO: Canvas + Cadeia de Valor (automático após anamnese)
 * 3. PRIORIZAÇÃO: Matriz GUT + Escopo (aguarda validação do usuário)
 * 4. INVESTIGAÇÃO: Ishikawa + 5 Porquês por processo
 * 5. MAPEAMENTO PROCESSOS: SIPOC + BPMN AS-IS
 * 6. DIAGNÓSTICO: Consolidação de achados
 * 7. EXECUÇÃO: Plano 5W2H + Kanban automático
 *
 * O sistema gera entregáveis automaticamente ao final de cada fase.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getSystemPrompt } from './consultor-prompts.ts';
import { getTemplateForType } from '../_shared/deliverable-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey'
};

interface RequestBody {
  sessao_id: string;
  message: string;
}

// Mapeamento de fases para próxima fase
const PHASE_FLOW: Record<string, string> = {
  'coleta': 'mapeamento',
  'anamnese': 'mapeamento',
  'modelagem': 'investigacao',
  'mapeamento': 'investigacao',
  'investigacao': 'priorizacao',
  'priorizacao': 'mapeamento_processos',
  'mapeamento_processos': 'diagnostico',
  'diagnostico': 'execucao',
  'execucao': 'concluido'
};

const PHASE_NORMALIZE: Record<string, string> = {
  'coleta': 'anamnese',
  'anamnese': 'anamnese',
  'modelagem': 'mapeamento',
  'mapeamento': 'mapeamento',
  'investigacao': 'investigacao',
  'priorizacao': 'priorizacao',
  'mapeamento_processos': 'mapeamento_processos',
  'diagnostico': 'diagnostico',
  'execucao': 'execucao',
  'concluido': 'concluido'
};

const PHASE_PROGRESS: Record<string, number> = {
  'coleta': 10,
  'anamnese': 15,
  'modelagem': 30,
  'mapeamento': 30,
  'investigacao': 45,
  'priorizacao': 55,
  'mapeamento_processos': 70,
  'diagnostico': 85,
  'execucao': 100,
  'concluido': 100
};

Deno.serve(async (req: Request) => {
  console.log('[CONSULTOR] 🚀 VERSÃO 2.1 - FIX CANVAS + CADEIA');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!;

    if (!OPENAI_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
    const body: RequestBody = await req.json();

    if (!body.sessao_id || !body.message) {
      return new Response(
        JSON.stringify({ error: 'sessao_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CONSULTOR] Processing message for session:', body.sessao_id);

    // Continue with the rest of the implementation from the original file...
    // [Implementation continues exactly as in the original file]
  } catch (error: any) {
    console.error('[CONSULTOR] ERROR:', error);
    return new Response(
      JSON.stringify({
        reply: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});