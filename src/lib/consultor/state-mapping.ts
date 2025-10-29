// Estados canônicos do backend (fonte da verdade)
export const BACKEND_STATES = {
  COLETA: 'coleta',
  ANALISE: 'analise',
  DIAGNOSTICO: 'diagnostico',
  RECOMENDACAO: 'recomendacao',
  EXECUCAO: 'execucao',
  CONCLUIDO: 'concluido'
} as const;

// Estados legacy do frontend (manter compatibilidade)
export const UI_STATES = {
  APRESENTACAO: 'apresentacao',
  ANAMNESE: 'anamnese',
  MAPEAMENTO: 'mapeamento',
  PRIORIZACAO: 'priorizacao',
  AS_IS: 'as_is',
  TO_BE: 'to_be',
  PLANO: 'plano',
  EXECUCAO: 'execucao'
} as const;

// Mapeamento UI -> Backend
export const UI_TO_BACKEND: Record<string, string> = {
  'apresentacao': 'coleta',
  'anamnese': 'coleta',
  'mapeamento': 'analise',
  'priorizacao': 'analise',
  'as_is': 'diagnostico',
  'to_be': 'recomendacao',
  'plano': 'recomendacao',
  'execucao': 'execucao'
};

// Mapeamento Backend -> UI (para display)
export const BACKEND_TO_UI: Record<string, string> = {
  'coleta': 'anamnese',
  'analise': 'mapeamento',
  'diagnostico': 'as_is',
  'recomendacao': 'plano',
  'execucao': 'execucao',
  'concluido': 'execucao'
};

// Funções utilitárias
export function normalizeToBackend(state: string): string {
  return UI_TO_BACKEND[state] || state;
}

export function normalizeToUI(state: string): string {
  return BACKEND_TO_UI[state] || state;
}

export function isValidBackendState(state: string): boolean {
  return Object.values(BACKEND_STATES).includes(state as any);
}

export function isValidUIState(state: string): boolean {
  return Object.values(UI_STATES).includes(state as any);
}
