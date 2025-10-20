// /src/utils/form-markers.ts
// Detectar e extrair marcadores de formulários das mensagens do assistente

export interface FormMarker {
  tipo: 'anamnese' | 'matriz_priorizacao';
  dados?: any; // opcional: se vier payload JSON embutido
}

/**
 * Normaliza texto para buscas (minúsculas, sem acentos).
 */
function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Remove blocos de code fence para evitar falsos positivos dentro de exemplos.
 */
function stripCodeFences(s: string): string {
  return (s || '').replace(/```[\s\S]*?```/g, '');
}

/**
 * Tenta extrair JSON logo após o marcador, caso exista, por exemplo:
 * [EXIBIR_FORMULARIO:anamnese]{ "empresa_nome": "ACME" }
 */
function tryParseInlineJson(afterMarker: string | undefined) {
  if (!afterMarker) return undefined;
  const trimmed = afterMarker.trim();
  if (!trimmed.startsWith('{')) return undefined;

  // Tenta equilibrar chaves para pegar o bloco JSON
  let depth = 0;
  let endIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) { endIdx = i + 1; break; }
    }
  }
  if (endIdx > 0) {
    const candidate = trimmed.slice(0, endIdx);
    try { return JSON.parse(candidate); } catch { /* ignore */ }
  }
  return undefined;
}

/**
 * Detecta marcadores do tipo [EXIBIR_FORMULARIO:anamnese] ou [EXIBIR_FORMULARIO:matriz_priorizacao]
 * Aceita variações de caixa e extrai JSON embutido logo em seguida, se existir.
 */
export function detectFormMarker(content: string): FormMarker | null {
  if (!content) return null;

  const withoutCode = stripCodeFences(content);
  const rx = /\[EXIBIR_FORMULARIO:(\w+)\]/i;
  const m = withoutCode.match(rx);
  if (!m) return null;

  const rawTipo = (m[1] || '').toLowerCase();
  let tipo: FormMarker['tipo'] | null = null;

  if (rawTipo === 'anamnese') tipo = 'anamnese';
  if (rawTipo === 'matriz_priorizacao') tipo = 'matriz_priorizacao';

  if (!tipo) return null;

  // tenta capturar JSON imediatamente após o marcador
  const after = withoutCode.slice(m.index! + m[0].length);
  const dados = tryParseInlineJson(after);

  return { tipo, ...(dados ? { dados } : {}) };
}

/**
 * Remove marcadores técnicos da resposta antes de exibir no chat.
 * - [EXIBIR_FORMULARIO:*]
 * - [GERAR_*]
 * - [AVANÇAR_ETAPA:*] / [AVANCAR_ETAPA:*]
 * - também limpa espaços extras remanescentes
 */
export function removeFormMarkers(content: string): string {
  if (!content) return '';

  return content
    // remove marcadores de formulário
    .replace(/\[EXIBIR_FORMULARIO:\w+\]/gi, '')
    // remove triggers de geração
    .replace(/\[GERAR_[A-Z_]+\]/g, '')
    // remove avanços de etapa (com e sem acento)
    .replace(/\[AVAN(C|Ç)AR_ETAPA:\w+\]/gi, '')
    // remove blocos JSON imediatamente após marcador, se ficaram soltos
    .replace(/\}\s*(?=\S)/g, '}\n')
    .trim();
}

/**
 * Indica se devemos mostrar um botão/CTA de formulário mesmo sem marcador explícito,
 * com base na etapa atual e no conteúdo da mensagem.
 */
export function shouldShowFormButton(content: string, etapaAtual?: string): boolean {
  if (!content) return false;

  const normalized = normalizeText(content);
  const hasExplicitMarker = /\[exibir_formulario:/i.test(content);
  if (hasExplicitMarker) return false;

  const etapa = normalizeText(etapaAtual || '');

  // Heurística para anamnese
  if (etapa === 'anamnese' || etapa === 'apresentacao') {
    const keys = ['nome', 'cargo', 'empresa', 'segmento', 'porte', 'desafios'];
    const hit = keys.some((kw) => normalized.includes(kw));
    return hit;
  }

  // Heurística para priorização
  if (etapa.startsWith('prioriza')) {
    // palavras com e sem acento
    const keys = ['prioriz', 'matriz', 'areas', 'ordem', 'comecar por', 'começar por'];
    const hit = keys.some((kw) => normalized.includes(normalizeText(kw)));
    return hit;
  }

  return false;
}
