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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0?target=deno';

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
   * ESTRATEGISTA: System prompt com especialização por setor e portfólio adaptativo
   */
  getSystemPrompt(params: {
    empresa?: string|null;
    setor?: string|null;
    adapter?: AdapterSetor|null;
    kb?: KBDoc[];
  }): string {
    const setor = String(params.setor || '').trim() || 'negócio do cliente';
    const empresa = String(params.empresa || '').trim() || 'empresa';
    const kpis = (params.adapter?.kpis ?? []).slice(0,8).join(', ');
    const perguntas = (params.adapter?.perguntas ?? []).slice(0,6).map((p,i)=>`${i+1}. ${p}`).join('\n');
    const metod = (params.adapter?.metodologias ?? []).slice(0,8).join(', ');

    const kbSnippets = (params.kb ?? []).slice(0,5).map(d =>
`### ${d.title} (${d.category})
${(d.content||'').slice(0,800)}...`).join('\n\n');

    return `Você é "Rafael", consultor sênior do PROCEda especializado em ${setor}.

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
   * TÁTICO: Parse actions from LLM response
   */
  parseActionsBlock(textoLLM: string): { actions: any[], contexto_incremental: any } {
    let idx = textoLLM.indexOf('\n---');

    if (idx === -1) {
      const jsonMatch = textoLLM.match(/\{[\s\S]*"actions"[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
            contexto_incremental: parsed?.contexto_incremental || {}
          };
        } catch {
          return { actions: [], contexto_incremental: {} };
        }
      }
      return { actions: [], contexto_incremental: {} };
    }

    const jsonStr = textoLLM.slice(idx + 4).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
        contexto_incremental: parsed?.contexto_incremental || {}
      };
    } catch {
      return { actions: [], contexto_incremental: {} };
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

    if (estadoAtual === 'apresentacao' || estadoAtual === 'anamnese' || estadoAtual === 'coleta') {
      return [
        { type: 'diagnose', area: 'geral', goals: ['mapear situação'], hypotheses: ['múltiplas causas'], needsValidation: true },
        ...basicDiag,
        { type: 'transicao_estado', to: 'as_is' }
      ];
    }

    if (estadoAtual === 'as_is') {
      return [
        { type: 'design_process_map', style: 'as_is', granularity: 'alto_nivel', deliver: 'text' },
        { type: 'analyze_dataset', source: 'upload', tasks: [{op:'pareto', field:'problema'}]},
        { type: 'transicao_estado', to: 'diagnostico' }
      ];
    }

    if (estadoAtual === 'diagnostico') {
      return [
        { type: 'compute_kpis', kpis: ['taxa_conversao','lead_time','custo_medio','satisfacao'] },
        { type: 'analyze_dataset', source: 'upload', tasks: [{op:'pareto', field:'motivo_problema'}]},
        ...basicDiag,
        { type: 'transicao_estado', to: 'to_be' }
      ];
    }

    if (estadoAtual === 'to_be') {
      return [
        { type: 'design_process_map', style: 'to_be', granularity: 'alto_nivel', deliver: 'text' },
        { type: 'what_if', model: 'melhoria', assumptions: {}, horizon: '3m' },
        { type: 'transicao_estado', to: 'plano' }
      ];
    }

    if (estadoAtual === 'plano') {
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
