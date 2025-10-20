// /src/utils/template-engine.ts
// DESCONTINUADO: A remixagem agora é feita pela LLM na chat-assistant
// Mantido apenas para compatibilidade com outras partes do sistema
export type VarsMap = Record<string, string | number | boolean | null | undefined>;

const VAR_RX = /\{\{\s*([a-zA-Z0-9_][\w\.\-]*)\s*\}\}/g;

export function detectVars(html: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VAR_RX.exec(html)) !== null) {
    found.add(m[1]);
  }
  const arr = Array.from(found);
  console.log('[DEPRECATED][template-engine] detectVars - use LLM remixing instead:', arr.length);
  return arr;
}

export function fillTemplate(html: string, vars: VarsMap): string {
  console.log('[DEPRECATED][template-engine] fillTemplate - use LLM remixing instead');
  const out = html.replace(VAR_RX, (_, key: string) => {
    const raw = (vars || {})[key];
    // Mantém chaves sem valor (útil para edição manual depois)
    if (raw === undefined || raw === null) {
      return '';
    }
    // Converte tudo para string de forma segura
    const val = String(raw);
    return escapeHtml(val);
  });
  return out;
}

// Escapa apenas para evitar quebrar HTML quando usuário digitar < >
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// DESCONTINUADO: dados fake agora são gerados pela LLM
export function makeSampleData(keys: string[]): VarsMap {
  const map: VarsMap = {};
  for (const k of keys) {
    const base = k.toLowerCase();
    if (base.includes('titulo')) map[k] = 'Planejamento estratégico – profissional';
    else if (base.includes('subtitulo')) map[k] = 'Resumo executivo e direcionadores 2025–2027';
    else if (base.includes('data')) map[k] = new Date().toLocaleDateString('pt-BR');
    else if (base.includes('autor') || base.includes('responsavel')) map[k] = 'Equipe BizMentor';
    else if (base.includes('progresso') || base.includes('percentual')) map[k] = 68;
    else if (base.includes('meta')) map[k] = '↑ 25%';
    else if (base.includes('atual')) map[k] = '17%';
    else map[k] = '—';
  }
  console.log('[DEPRECATED][template-engine] makeSampleData - use LLM instead');
  return map;
}
