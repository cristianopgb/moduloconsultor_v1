/**
 * Motor de Busca Semântica de Hints
 *
 * Busca situações relevantes na base proceda_hints usando:
 * - Relevância textual no scenario (full-text search)
 * - Match de segmento
 * - Match de domínio com a dor
 * - Score composto com prioridade
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface HintSearchContext {
  segmento?: string;
  dor_principal?: string;
  achados?: string[];
  expressoes_usuario?: string[];
}

export interface HintResult {
  id: string;
  title: string;
  recommendations: string;
  score: number;
  segmentos: string[];
  dominios: string[];
}

/**
 * Cache simples de hints por sessão para evitar buscas repetidas
 */
const sessionHintsCache = new Map<string, { hints: HintResult[], timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Limpa cache expirado (chamado periodicamente)
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of sessionHintsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      sessionHintsCache.delete(key);
    }
  }
}

/**
 * Gera chave de cache baseada no contexto
 */
function getCacheKey(context: HintSearchContext): string {
  return JSON.stringify({
    seg: context.segmento || '',
    dor: (context.dor_principal || '').substring(0, 50), // Primeiros 50 chars
    ach: (context.achados || []).slice(0, 3) // Primeiros 3 achados
  });
}

/**
 * Normaliza segmento para vocabulário controlado
 */
function normalizeSegmento(segmento?: string): string[] {
  if (!segmento) return [];

  const seg = segmento.toLowerCase();
  const normalized: string[] = [];

  // Mapeamento de sinônimos
  if (seg.includes('ecommerce') || seg.includes('e-commerce') || seg.includes('loja online') || seg.includes('varejo online')) {
    normalized.push('ecommerce', 'varejo_online', 'loja_online');
  }
  if (seg.includes('saas') || seg.includes('software') || seg.includes('tecnologia') || seg.includes('ti')) {
    normalized.push('saas', 'tecnologia', 'software');
  }
  if (seg.includes('consultoria') || seg.includes('servico') || seg.includes('serviço')) {
    normalized.push('servicos', 'consultoria');
  }
  if (seg.includes('industria') || seg.includes('indústria') || seg.includes('fabrica') || seg.includes('fábrica') || seg.includes('producao') || seg.includes('produção')) {
    normalized.push('industria', 'producao', 'manufatura');
  }
  if (seg.includes('varejo') || seg.includes('loja')) {
    normalized.push('varejo_fisico', 'loja');
  }
  if (seg.includes('agencia') || seg.includes('agência')) {
    normalized.push('agencia', 'servicos');
  }

  return normalized.length > 0 ? normalized : [seg];
}

/**
 * Detecta domínios mencionados na dor/achados
 */
function detectDominios(context: HintSearchContext): string[] {
  const text = [
    context.dor_principal || '',
    ...(context.achados || []),
    ...(context.expressoes_usuario || [])
  ].join(' ').toLowerCase();

  const dominios: string[] = [];

  // VENDAS: conversão, pipeline, fechamento
  if (text.match(/vend|comercial|client|prospect|pipeline|conversion|fechamento|proposta|negociac|funil|lead|oportunidade|ticket|receita|faturamento|comissao/i)) {
    dominios.push('vendas');
  }

  // MARKETING: atração, branding, conteúdo, tráfego
  if (text.match(/marketing|divulga|propaganda|ads|anuncio|trafego|seo|conteudo|rede social|branding|marca|campanha|midia|inbound|outbound|publico|audiencia|engajamento/i)) {
    dominios.push('marketing');
  }

  // OPERAÇÕES: processos, produção, eficiência
  if (text.match(/operac|process|produc|eficienc|otimiz|fluxo|procedimento|rotina|desperdicio|gargalo|capacidade|throughput|lead time|setup|manufatura/i)) {
    dominios.push('operacoes');
  }

  // FINANCEIRO: custos, margens, caixa, faturamento
  if (text.match(/financ|custo|margem|lucro|caixa|fluxo de caixa|rentabilidade|faturamento|inadimplenc|cobranca|pagamento|orcamento|investimento|capital de giro|ebitda|dre/i)) {
    dominios.push('financeiro');
  }

  // RH / PESSOAS: equipe, rotatividade, capacitação
  if (text.match(/pessoa|equipe|funcionario|colaborador|rh|recursos humanos|contrata|demiss|rotatividade|turn ?over|engajamento|motivacao|treinamento|capacitacao|talento|clima|cultura/i)) {
    dominios.push('rh');
  }

  // LOGÍSTICA: estoque, entrega, armazenagem
  if (text.match(/estoque|logistic|entrega|armazem|supply|distribuic|transporte|inventario|ruptura|giro de estoque|picking|packing|last mile|expedicao/i)) {
    dominios.push('logistica');
  }

  // QUALIDADE: defeitos, não-conformidades, retrabalho
  if (text.match(/qualidade|defeito|refugo|retrabalho|nao.conformidade|reclamac|devoluc|garantia|inspecao|auditoria|certificacao|iso|controle de qualidade|cep|six sigma/i)) {
    dominios.push('qualidade');
  }

  // TI / TECNOLOGIA: sistemas, integração, automação
  if (text.match(/sistema|tecnologia|ti|software|integrac|automac|digital|erp|crm|api|banco de dados|infraestrutura|cloud|seguranca|cyber|aplicativo|plataforma/i)) {
    dominios.push('ti');
  }

  // GESTÃO: indicadores, governança, estratégia (NOVO)
  if (text.match(/gestao|governanca|estrateg|indicador|kpi|meta|planejamento|controle gerencial|bsc|dashboard|diretriz|politica|compliance|auditoria interna/i)) {
    dominios.push('gestao');
  }

  // JURÍDICO / COMPLIANCE (NOVO)
  if (text.match(/juridico|legal|compliance|regulatorio|contrato|clausula|acordo|processo judicial|trabalhista|lgpd|gdpr|privacidade|licenca|alvara/i)) {
    dominios.push('juridico');
  }

  return [...new Set(dominios)]; // Remove duplicatas
}

/**
 * Busca hints relevantes com scoring inteligente
 */
export async function searchRelevantHints(
  supabase: SupabaseClient,
  sessaoId: string,
  context: HintSearchContext,
  maxResults = 3
): Promise<HintResult[]> {
  try {
    // Limpar cache expirado periodicamente (1% de chance)
    if (Math.random() < 0.01) {
      cleanExpiredCache();
    }

    // Verificar cache
    const cacheKey = getCacheKey(context);
    const cached = sessionHintsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      console.log('[HINTS] Using cached results for session:', sessaoId);
      return cached.hints;
    }

    // Construir contexto de busca
    const segmentosNormalizados = normalizeSegmento(context.segmento);
    const dominiosDetectados = detectDominios(context);

    // Query textual para scenario
    const searchTerms = [
      context.dor_principal || '',
      ...(context.achados || []),
      ...(context.expressoes_usuario || [])
    ]
      .filter(t => t.length > 3)
      .slice(0, 5) // Max 5 termos
      .join(' ');

    console.log('[HINTS] Search context:', {
      segmentos: segmentosNormalizados,
      dominios: dominiosDetectados,
      searchTerms: searchTerms.substring(0, 100)
    });

    if (!searchTerms && segmentosNormalizados.length === 0) {
      console.log('[HINTS] Insufficient context for search');
      return [];
    }

    // Buscar hints com scoring
    // Score = relevância_texto (50%) + match_segmento (30%) + match_dominio (20%)
    const { data: hints, error } = await supabase
      .from('proceda_hints')
      .select('id, title, recommendations, segmentos, dominios, prioridade, uso_count, aceite_rate')
      .eq('ativo', true)
      .or(
        segmentosNormalizados.length > 0
          ? `segmentos.cs.{${segmentosNormalizados.join(',')}}`
          : 'id.not.is.null' // Fallback: busca qualquer hint ativo
      )
      .limit(20); // Buscar mais para depois filtrar e ordenar

    if (error) {
      console.error('[HINTS] Error fetching hints:', error);
      return [];
    }

    if (!hints || hints.length === 0) {
      console.log('[HINTS] No hints found');
      return [];
    }

    // Calcular score para cada hint
    const scoredHints = hints.map(hint => {
      let score = 0;

      // 1. Relevância textual (50 pontos)
      const scenarioLower = (hint as any).scenario?.toLowerCase() || '';
      const searchLower = searchTerms.toLowerCase();
      const words = searchLower.split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(word => scenarioLower.includes(word)).length;
      const textRelevance = Math.min((matches / Math.max(words.length, 1)) * 50, 50);
      score += textRelevance;

      // 2. Match de segmento (30 pontos)
      const segmentMatch = segmentosNormalizados.some(seg =>
        hint.segmentos.includes(seg)
      );
      if (segmentMatch) score += 30;

      // 3. Match de domínio (20 pontos)
      const dominioMatch = dominiosDetectados.some(dom =>
        hint.dominios.includes(dom)
      );
      if (dominioMatch) score += 20;

      // Bonus por prioridade (0-10 pontos)
      score += (hint.prioridade || 5) * 1;

      // Bonus por efetividade histórica (0-10 pontos)
      if (hint.uso_count > 0 && hint.aceite_rate) {
        score += (hint.aceite_rate / 10); // aceite_rate 0-100 -> 0-10 pontos
      }

      return {
        id: hint.id,
        title: hint.title,
        recommendations: hint.recommendations,
        score: Math.round(score),
        segmentos: hint.segmentos,
        dominios: hint.dominios
      };
    });

    // Ordenar por score e pegar top N
    scoredHints.sort((a, b) => b.score - a.score);
    const topHints = scoredHints.slice(0, maxResults);

    console.log('[HINTS] Found hints:', {
      total: hints.length,
      scored: scoredHints.length,
      returning: topHints.length,
      topScores: topHints.map(h => ({ title: h.title, score: h.score }))
    });

    // Cachear resultado
    sessionHintsCache.set(cacheKey, {
      hints: topHints,
      timestamp: Date.now()
    });

    return topHints;

  } catch (error) {
    console.error('[HINTS] Exception in searchRelevantHints:', error);
    return []; // Fail gracefully
  }
}

/**
 * Formata hints para injeção no prompt (máximo 5 linhas)
 */
export function formatHintsForPrompt(hints: HintResult[]): string {
  if (!hints || hints.length === 0) {
    return '';
  }

  const formatted = hints.map(hint => {
    // Pegar primeiras 2-3 recomendações (splits por |)
    const recs = hint.recommendations.split('|').slice(0, 2).map(r => r.trim());
    return `  • ${hint.title}: ${recs.join('; ')}`;
  }).join('\n');

  return `\n\nSUGESTÕES RELEVANTES (Base de Situações):\n${formatted}\n\n**IMPORTANTE**: Use essas sugestões como bússola para O QUÊ propor. Você deve detalhar o COMO com 7-10 etapas práticas.\n`;
}

/**
 * Registra uso de hint na telemetria
 */
export async function logHintUsage(
  supabase: SupabaseClient,
  sessaoId: string,
  hintId: string,
  fase: string,
  context: HintSearchContext,
  score: number,
  grupoAB: string = 'control',
  qualityMetrics?: { acao_density?: number, how_depth_avg?: number, kpis_count?: number, reissue_count?: number }
) {
  try {
    await supabase.from('proceda_hints_telemetry').insert({
      hint_id: hintId,
      sessao_id: sessaoId,
      fase: fase,
      usado_em_acao: false, // Será atualizado depois se virar action
      contexto_busca: {
        segmento: context.segmento,
        dor: context.dor_principal,
        achados_count: (context.achados || []).length
      },
      score_busca: score,
      grupo_ab: grupoAB,
      // Métricas de qualidade (opcionais)
      acao_density: qualityMetrics?.acao_density,
      how_depth_avg: qualityMetrics?.how_depth_avg,
      kpis_count: qualityMetrics?.kpis_count,
      reissue_count: qualityMetrics?.reissue_count || 0
    });

    console.log('[HINTS] Logged hint usage:', hintId, qualityMetrics ? 'with quality metrics' : '');
  } catch (error) {
    console.warn('[HINTS] Error logging telemetry (non-fatal):', error);
  }
}

/**
 * Determina grupo A/B para testes silenciosos
 * 80% control (3 hints), 20% test (1-2 hints)
 */
export function determineABGroup(): { group: string, maxHints: number } {
  const rand = Math.random();

  if (rand < 0.80) {
    return { group: 'control', maxHints: 3 };
  } else if (rand < 0.90) {
    return { group: 'test_1_hint', maxHints: 1 };
  } else {
    return { group: 'test_2_hints', maxHints: 2 };
  }
}
