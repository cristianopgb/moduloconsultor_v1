/**
 * ARQUITETURA DE 3 CAMADAS ADAPTATIVAS
 *
 * 1. ESTRATEGISTA (Planner): Decide qual abordagem usar baseado no contexto
 *    - Identifica domínio (Receita, Operações, Financeiro, Pessoas)
 *    - Define objetivos, hipóteses e evidências necessárias
 *    - Escolhe métodos apropriados do portfólio adaptativo
 *
 * 2. TÁTICO (Action Router): Converte plano em ações executáveis
 *    - Usa portfólio flexível de métodos (não força Ishikawa/SIPOC/BPMN)
 *    - Escolhe alternativas se ferramenta não se aplica
 *    - Limita a 1 pergunta por turno, assume hipóteses com needsValidation
 *
 * 3. EXECUTOR (Function Registry): Executa ações e gera evidências
 *    - query_sql, analyze_dataset, compute_kpis, pareto, what_if, etc.
 *    - Cada ação retorna evidência (resultado + fonte + confiança)
 *    - Gera entregáveis que referenciam evidências
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { BACKEND_STATES } from '../_shared/state-mapping.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { getLLM } from '../_shared/llm-config.ts';
import {
  ANAMNESE_PROMPT,
  MODELAGEM_PROMPT,
  INVESTIGACAO_PROMPT,
  PRIORIZACAO_PROMPT,
  MAPEAMENTO_PROMPT,
  DIAGNOSTICO_PROMPT,
  EXECUCAO_PROMPT,
  type ConsultorPhase
} from './consultor-prompts.ts';

export interface SessaoConsultor {
  id: string;
  user_id: string;
  conversation_id: string | null;
  titulo_problema: string;
  empresa?: string | null;
  setor?: string | null;
  contexto_negocio: any;
  metodologias_aplicadas: string[];
  estado_atual: string;
  documentos_usados: string[];
  historico_rag: any[];
  entregaveis_gerados: string[];
  progresso: number;
  ativo: boolean;
}

export interface AdapterSetor {
  id: string;
  setor: string;
  prioridade?: number;
  tags?: string[];
  kpis?: string[];
  perguntas?: string[];
  metodologias?: string[];
}

export interface KBDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  aplicabilidade?: any;
}

export class ConsultorOrchestrator {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * ESTRATEGISTA: Carrega adapter por setor
   */
  async loadAdapterFor(sessao: { setor?: string|null; empresa?: string|null }): Promise<AdapterSetor | null> {
    const setor = String(sessao?.setor || '').trim().toLowerCase();
    if (!setor) return null;

    const { data, error } = await this.supabase
      .from('adapters_setor')
      .select('id,setor,prioridade,tags,kpis,perguntas,metodologias')
      .ilike('setor', `%${setor}%`)
      .order('prioridade', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.warn('[ORCH] adapter error', error);
    return data || null;
  }

  /**
   * ESTRATEGISTA: Carrega documentos da Knowledge Base
   */
  async loadKnowledgeBaseBlocs(tagsDesejadas: string[], limit = 6): Promise<KBDoc[]> {
    if (!tagsDesejadas?.length) return [];

    const { data, error } = await this.supabase
      .from('knowledge_base_documents')
      .select('id,title,category,content,tags,aplicabilidade')
      .overlaps('tags', tagsDesejadas)
      .eq('ativo', true)
      .limit(limit);

    if (error) {
      console.warn('[ORCH] kb error', error);
      return [];
    }
    return (data ?? []) as KBDoc[];
  }

  /**
   * Mapeia estado do backend para prompt de fase
   */
  getPhasePrompt(estado: string): ConsultorPhase {
    const estadoNorm = String(estado || '').trim().toLowerCase();

    // Mapear estado do banco para fase do consultor
    const mapping: Record<string, ConsultorPhase> = {
      'coleta': ANAMNESE_PROMPT,
      'anamnese': ANAMNESE_PROMPT,
      'modelagem': MODELAGEM_PROMPT,
      'investigacao': INVESTIGACAO_PROMPT,
      'priorizacao': PRIORIZACAO_PROMPT,
      'mapeamento': MAPEAMENTO_PROMPT,
      'diagnostico': DIAGNOSTICO_PROMPT,
      'to_be': DIAGNOSTICO_PROMPT,  // to_be = diagnostico na prática
      'as_is': MAPEAMENTO_PROMPT,   // as_is = mapeamento
      'execucao': EXECUCAO_PROMPT,
      'plano': EXECUCAO_PROMPT,
      'concluido': EXECUCAO_PROMPT
    };

    return mapping[estadoNorm] || ANAMNESE_PROMPT; // Default: começar pela anamnese
  }

  /**
   * ESTRATEGISTA: System prompt com especialização por setor e portfólio adaptativo
   */
  getSystemPrompt(params: {
    empresa?: string|null;
    setor?: string|null;
    adapter?: AdapterSetor|null;
    kb?: KBDoc[];
    estado?: string;
    contextoColeta?: Record<string, any>;
  }): string {
    // 1. Obter prompt específico da fase
    const phase = this.getPhasePrompt(params.estado || 'coleta');

    const setor = String(params.setor || '').trim() || 'negócio do cliente';
    const empresa = String(params.empresa || '').trim() || 'empresa';
    const kpis = (params.adapter?.kpis ?? []).slice(0,8).join(', ');
    const perguntas = (params.adapter?.perguntas ?? []).slice(0,6).map((p,i)=>`${i+1}. ${p}`).join('\n');
    const metod = (params.adapter?.metodologias ?? []).slice(0,8).join(', ');

    const kbSnippets = (params.kb ?? []).slice(0,5).map(d =>
`### ${d.title} (${d.category})
${(d.content||'').slice(0,800)}...`).join('\n\n');

    // Formatar contexto já coletado
    const contexto = params.contextoColeta || {};
    const contextoStr = Object.keys(contexto).length > 0
      ? Object.entries(contexto)
          .map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`)
          .join('\n')
      : '  (nenhum dado coletado ainda)';

    // 2. Usar o prompt da fase como base
    return `${phase.systemPrompt}

# CONTEXTO JÁ COLETADO DA SESSÃO

Os seguintes dados JÁ foram coletados (NÃO pergunte novamente):
${contextoStr}

# CONTEXTO ADICIONAL DO SETOR

**Setor:** ${setor}
**Empresa:** ${empresa}
**KPIs-chave:** ${kpis || '(não cadastrado)'}

**Perguntas úteis do setor:**
${perguntas || '-'}

**Metodologias preferidas:** ${metod || '-'}

# BASE DE CONHECIMENTO (trechos relevantes)

${kbSnippets || '(sem documentos relevantes)'}

# LEMBRE-SE

# ARQUITETURA DE 3 CAMADAS

## 1. ESTRATEGISTA (você agora)
- Identifique domínio principal: Receita/Comercial | Operações/Logística | Financeiro/FP&A | Pessoas/HR
- Defina hipóteses baseadas no contexto: problemas prováveis, causas raiz, oportunidades
- Escolha métodos do PORTFÓLIO ADAPTATIVO (não force ferramentas fixas)

## 2. PORTFÓLIO DE MÉTODOS (escolha o mais adequado)

**Receita/Comercial:**
- AARRR (pirata metrics): aquisição, ativação, retenção, receita, referral
- Funil de conversão por etapa
- Pareto de perdas (onde concentra 80%)
- Teste de proposta / ICP (ideal customer profile)
- CAC vs LTV, Payback period
- Análise de canais

**Operações/Logística:**
- OTIF (on-time in-full)
- Lead time, takt time
- Mapeamento de desperdícios (muda)
- Curva ABC de SKU
- Balanceamento de carga
- Picking accuracy

**Financeiro/FP&A:**
- DRE e fluxo de caixa
- AR/AP aging policy
- Driver tree de margem
- Projeção de cenários (what-if)
- Ponto de equilíbrio

**Pessoas/HR:**
- Absenteísmo e turnover
- Matriz 9-box
- Curva de aprendizagem
- RACI (responsabilidade)

**Ferramentas Clássicas (use SE fizer sentido):**
- Ishikawa: quando causas difusas, múltiplas variáveis
- SIPOC: quando processo bem definido mas não documentado
- BPMN: quando precisa mapear fluxo complexo
- GUT: priorização simples
- 5W2H: plano de ação estruturado

## 3. POLÍTICA ANTI-INTERROGATÓRIO

**CRÍTICO:**
- Máximo **1 pergunta** por turno, SOMENTE se destravar próxima ação
- Se dado não-crítico faltar: ASSUMA hipótese razoável com needsValidation:true
- Pareto de informação: peça apenas arquivos/dados que destravam análise IMEDIATA
- Nunca repita mesma pergunta: se usuário não respondeu, assuma e prossiga
- **SEMPRE** retorne actions[] úteis (nunca vazio)

## 4. CONTEXTO SETORIAL

**Setor:** ${setor}
**Empresa:** ${empresa}
**KPIs-chave:** ${kpis || '(não cadastrado)'}

**Perguntas úteis do setor:**
${perguntas || '-'}

**Metodologias preferidas:** ${metod || '-'}

## 5. BASE DE CONHECIMENTO (trechos relevantes)

${kbSnippets || '(sem documentos relevantes)'}

## 6. FORMATO DE RESPOSTA (OBRIGATÓRIO)

[PARTE A]
Texto curto ao usuário (sem jargão). Explique o que vai fazer agora e por quê.

[PARTE B]
{
  "actions": [
    // Exemplos de actions válidas:
    {"type":"diagnose","area":"comercial","goals":["aumentar conversão"],"hypotheses":["ICP difuso"],"needsValidation":true},
    {"type":"analyze_dataset","source":"upload|table:public.vendas","tasks":[{"op":"kpi","name":"taxa_conversao","groupBy":"etapa"}]},
    {"type":"compute_kpis","kpis":["CAC","LTV","Payback","TicketMedio"]},
    {"type":"what_if","model":"receita","assumptions":{"taxa_conv":"+2pp","ticket":"+8%"},"horizon":"6m"},
    {"type":"design_process_map","style":"as_is|to_be","granularity":"alto_nivel","deliver":"diagram|text"},
    {"type":"create_doc","docType":"diagnostico_exec","format":"markdown","sections":["resumo_exec","achados_top5","roadmap_90d"]},
    {"type":"update_kanban","board":"execucao","cards":[{"title":"Padronizar proposta","owner":"Comercial","due":"+7d"}]},
    {"type":"transicao_estado","to":"diagnostico"}
  ],
  "contexto_incremental": { "empresa":"${empresa}","setor":"${setor}","needsValidation":false }
}

## 7. ANTI-LOOP

Se você não souber o que fazer: gere ações genéricas para coleta de evidência (analyze_dataset, compute_kpis, create_doc). Nunca retorne actions vazio.`;
  }

  /**
   * TÁTICO: Few-shot example para transportadora (sem forçar Ishikawa)
   */
  getFewShotExample(): string {
    return `[EXEMPLO – TRANSPORTES/LOGÍSTICA]
Usuário: "Sou transportadora fracionada, minhas vendas não escalam e o financeiro está desorganizado."
Assistente (modelo de resposta correta):
[PARTE A]
Vamos atacar duas frentes em paralelo:
1) Comercial: hipóteses — funil fraco (prospecção manual), proposta não padronizada, ICP inexistente.
   Entregáveis: GUT (gargalos de conversão) + SIPOC do processo comercial AS IS.
2) Financeiro: hipóteses — DRE inconsistente, prazos/recebíveis sem política, rateio logístico ausente.
   Entregáveis: 5W2H com 6 itens de correção (política por cliente, checklist de faturamento, calendário de prazos).
---
{
  "actions":[
    {"type":"gerar_entregavel","deliverableType":"gut","contexto":{"tema":"Gargalos de conversão comercial"}},
    {"type":"gerar_entregavel","deliverableType":"sipoc","contexto":{"process":"Pré-venda → Proposta → Fechamento → Onboarding"}},
    {"type":"gerar_entregavel","deliverableType":"5w2h","contexto":{"itens":[{"what":"Padronizar proposta","who":"Comercial","when":"7d"}]}},
    {"type":"transicao_estado","to":"diagnostico"}
  ],
  "contexto_incremental":{"setor_prioritario":"Comercial+Financeiro","needsValidation":true}
}`;
  }

  /**
   * TÁTICO: Parse actions from LLM response with multiple fallbacks
   */
  /**
   * Parser robusto: busca [PARTE B] delimitado
   */
  parseActionsBlockRobust(text: string): { actions: any[]; etapa?: string; contexto_incremental?: any; next_step?: string } {
    // Tenta delimitadores claros
    const start = text.indexOf('[PARTE B - INICIO]');
    const end = text.indexOf('[PARTE B - FIM]');
    let candidate = '';

    if (start !== -1 && end !== -1 && end > start) {
      candidate = text.substring(start + '[PARTE B - INICIO]'.length, end);
    } else {
      // Fallback: maior bloco JSON com "actions"
      const jsonLike = text.match(/\{[\s\S]*?"actions"[\s\S]*?\}/g);
      candidate = jsonLike ? jsonLike.sort((a, b) => b.length - a.length)[0] : '';
    }

    if (!candidate) {
      console.warn('[ORCH] No [PARTE B] block found');
      return { actions: [] };
    }

    // Remove ruídos comuns
    const cleaned = candidate
      .replace(/\[PARTE B - INICIO\]/g, '')
      .replace(/\[PARTE B - FIM\]/g, '')
      .replace(/```json|```/g, '')
      .trim();

    try {
      const obj = JSON.parse(cleaned);
      if (!Array.isArray(obj.actions)) {
        console.warn('[ORCH] No actions array in parsed JSON');
        return { actions: [] };
      }

      // Validar actions
      const validActions = obj.actions.filter((a: any) => a && typeof a === 'object' && a.type);

      return {
        actions: validActions,
        etapa: obj.etapa,
        contexto_incremental: obj.contexto_incremental,
        next_step: obj.next_step
      };
    } catch (e) {
      console.error('[ORCH] JSON parse fail:', e);
      return { actions: [] };
    }
  }

  /**
   * Guard anti-opinião
   */
  private enforceNoOpinionStyle(parteA: string): void {
    const banned = [
      "o que você prefere",
      "qual opção você quer",
      "qual sua sugestão",
      "o que você acha",
      "deveríamos",
      "prefere que eu"
    ];
    const lower = parteA.toLowerCase();
    if (banned.some(b => lower.includes(b))) {
      throw new Error("Modelo desviou para opinião/sugestão. Reforçar sistema.");
    }
  }

  /**
   * Validação de saída
   */
  private validateModelOutput(parsed: any): void {
    const etapas = ["coleta", "analise", "diagnostico", "recomendacao", "execucao", "concluido"];
    const actionTypes = [
      "transicao_estado", "criar_entregavel", "atualizar_kanban",
      "analyze_dataset", "compute_kpis", "design_process_map"
    ];
    const nextSteps = ["confirmacao", "acao", "pergunta"];

    if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON [PARTE B].");
    if (parsed.etapa && !etapas.includes(parsed.etapa)) throw new Error("Invalid etapa.");
    if (!Array.isArray(parsed.actions)) throw new Error("actions must be array.");

    for (const a of parsed.actions) {
      if (!a?.type) throw new Error("action missing type.");
      if (!actionTypes.includes(a.type)) {
        console.warn(`[ORCH] Unknown action type: ${a.type} (allowing)`);
      }
      if (a.payload !== undefined && typeof a.payload !== "object") {
        throw new Error("action.payload must be object.");
      }
    }

    if (parsed.next_step && !nextSteps.includes(parsed.next_step)) {
      throw new Error("Invalid next_step.");
    }
  }

  /**
   * Garante que transicao_estado sempre tenha um alvo 'to'
   * Normaliza diferentes estruturas possíveis para formato canônico
   */
  fixTransicaoEstadoTargets(actions: any[], estadoAtualBackend: string): any[] {
    const safeState = (s: any) => (s || '').toString().trim().toLowerCase() || 'coleta';

    return (actions || []).map((a) => {
      if (!a || typeof a !== 'object') return a;

      const actionType = (a.type || '').toString().toLowerCase();
      if (actionType !== 'transicao_estado') return a;

      // Normaliza campos possíveis
      const payload = a.payload || a.params || {};
      const to =
        a.to ??
        payload.to ??
        payload.novo_estado ??
        payload.estado ??
        a.estado ??
        a.novo_estado ??
        a.target ??
        a.state ??
        null;

      const alvo = safeState(to) || safeState(estadoAtualBackend);

      // Reescreve de forma canônica
      return {
        type: 'transicao_estado',
        payload: { to: alvo }
      };
    });
  }

  parseActionsBlock(textoLLM: string): { actions: any[], contexto_incremental: any } {
    console.log('[ORCH] Parsing actions from LLM response...');

    // TENTATIVA 1: Parsing com delimitador ---
    let idx = textoLLM.indexOf('\n---');
    if (idx !== -1) {
      const jsonStr = textoLLM.slice(idx + 4).trim();
      const result = this.tryParseJSON(jsonStr, 'delimiter');
      if (result) return result;
    }

    // TENTATIVA 2: Buscar bloco JSON com delimitadores claros
    const delimitedMatch = textoLLM.match(/\[PARTE B.*?\]\s*(\{[\s\S]*?\})\s*(?:\[|$)/i);
    if (delimitedMatch) {
      const result = this.tryParseJSON(delimitedMatch[1], 'delimited-block');
      if (result) return result;
    }

    // TENTATIVA 3: Regex para encontrar JSON com "actions"
    const jsonMatch = textoLLM.match(/\{[\s\S]*?"actions"[\s\S]*?\}/);
    if (jsonMatch) {
      const result = this.tryParseJSON(jsonMatch[0], 'regex-match');
      if (result) return result;
    }

    // TENTATIVA 4: Buscar ultimo bloco JSON valido no texto
    const allBraces = [...textoLLM.matchAll(/\{/g)];
    for (let i = allBraces.length - 1; i >= 0; i--) {
      const startIdx = allBraces[i].index!;
      const substring = textoLLM.slice(startIdx);
      const result = this.tryParseJSON(substring, 'last-json-block');
      if (result) return result;
    }

    // TENTATIVA 5: Extrair apenas array de actions se existir
    const actionsMatch = textoLLM.match(/"actions"\s*:\s*(\[[\s\S]*?\])/);
    if (actionsMatch) {
      try {
        const actions = JSON.parse(actionsMatch[1]);
        if (Array.isArray(actions)) {
          console.log('[ORCH] Extracted actions array directly');
          return { actions, contexto_incremental: {} };
        }
      } catch (e) {
        console.warn('[ORCH] Failed to parse actions array:', e);
      }
    }

    console.warn('[ORCH] All parsing attempts failed');
    return { actions: [], contexto_incremental: {} };
  }

  /**
   * Tenta parsear JSON e valida estrutura
   */
  private tryParseJSON(jsonStr: string, source: string): { actions: any[], contexto_incremental: any } | null {
    try {
      let cleaned = jsonStr.trim();

      // Remover trailing comma antes de } ou ]
      cleaned = cleaned.replace(/,(\s*[\}\]])/g, '$1');

      const parsed = JSON.parse(cleaned);

      if (!parsed || typeof parsed !== 'object') {
        console.warn(`[ORCH] Invalid structure from ${source}`);
        return null;
      }

      let actions = parsed.actions;
      if (!Array.isArray(actions)) {
        console.warn(`[ORCH] No actions array from ${source}`);
        return null;
      }

      // Validar cada action tem campo type
      actions = actions.filter(a => a && typeof a === 'object' && a.type);

      if (actions.length === 0) {
        console.warn(`[ORCH] No valid actions from ${source}`);
        return null;
      }

      console.log(`[ORCH] Successfully parsed ${actions.length} actions from ${source}`);

      return {
        actions,
        contexto_incremental: parsed.contexto_incremental || {}
      };

    } catch (e: any) {
      console.warn(`[ORCH] JSON parse failed for ${source}:`, e.message);
      return null;
    }
  }

  /**
   * TÁTICO: Synthesize fallback actions (Enforcer anti-loop)
   * Gera ações genéricas adaptadas à fase, SEM forçar ferramentas específicas
   */
  synthesizeFallbackActions(estadoAtual: string, userMsg: string): any[] {
    // Fallback genérico: evidência primeiro, ferramentas depois
    const basicDiag = [
      { type: 'create_doc', docType: 'diagnostico_exec', format: 'markdown',
        sections: ['resumo_exec','achados_top5','oportunidades_top5','roadmap_90d'] }
    ];

    if (estadoAtual === BACKEND_STATES.COLETA) {
      return [
        { type: 'diagnose', area: 'geral', goals: ['mapear situação'], hypotheses: ['múltiplas causas'], needsValidation: true },
        ...basicDiag,
        { type: 'transicao_estado', to: BACKEND_STATES.ANALISE }
      ];
    }

    if (estadoAtual === BACKEND_STATES.ANALISE) {
      return [
        { type: 'design_process_map', style: 'as_is', granularity: 'alto_nivel', deliver: 'text' },
        { type: 'analyze_dataset', source: 'upload', tasks: [{op:'pareto', field:'problema'}]},
        { type: 'transicao_estado', to: BACKEND_STATES.DIAGNOSTICO }
      ];
    }

    if (estadoAtual === BACKEND_STATES.DIAGNOSTICO) {
      return [
        { type: 'compute_kpis', kpis: ['taxa_conversao','lead_time','custo_medio','satisfacao'] },
        { type: 'analyze_dataset', source: 'upload', tasks: [{op:'pareto', field:'motivo_problema'}]},
        ...basicDiag,
        { type: 'transicao_estado', to: BACKEND_STATES.RECOMENDACAO }
      ];
    }

    if (estadoAtual === BACKEND_STATES.RECOMENDACAO) {
      return [
        { type: 'design_process_map', style: 'to_be', granularity: 'alto_nivel', deliver: 'text' },
        { type: 'what_if', model: 'melhoria', assumptions: {}, horizon: '3m' },
        { type: 'transicao_estado', to: BACKEND_STATES.EXECUCAO }
      ];
    }

    if (estadoAtual === BACKEND_STATES.EXECUCAO) {
      return [
        { type: 'create_doc', docType: '5w2h', format: 'markdown', sections: ['plan_table'] },
        { type: 'update_kanban', board: 'execucao',
          cards: [
            { title: 'Executar ação prioritária 1', owner: 'Time', due: '+7d'},
            { title: 'Executar ação prioritária 2', owner: 'Time', due: '+14d'}
          ]},
        { type: 'transicao_estado', to: 'execucao' }
      ];
    }

    return basicDiag;
  }

}
