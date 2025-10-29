// src/lib/consultor/state-mapping.ts
// Fonte da verdade: estados do BACKEND
export type BackendState =
  | 'coleta'        // UI: anamnese
  | 'analise'       // UI: as_is
  | 'diagnostico'   // UI: to_be
  | 'recomendacao'  // UI: plano
  | 'execucao'      // UI: execucao
  | 'concluido';    // UI: concluido (se existir)

export type UIState =
  | 'anamnese'
  | 'as_is'
  | 'to_be'
  | 'plano'
  | 'execucao'
  | 'concluido';

const toUIMap: Record<BackendState, UIState> = {
  coleta: 'anamnese',
  analise: 'as_is',
  diagnostico: 'to_be',
  recomendacao: 'plano',
  execucao: 'execucao',
  concluido: 'concluido'
};

const toBackendMap: Record<UIState, BackendState> = {
  anamnese: 'coleta',
  as_is: 'analise',
  to_be: 'diagnostico',
  plano: 'recomendacao',
  execucao: 'execucao',
  concluido: 'concluido'
};

export function normalizeToUI(state: string | null | undefined): UIState {
  const s = (state || '').toLowerCase() as BackendState;
  return toUIMap[s] ?? 'anamnese';
}

export function normalizeToBackend(state: string | null | undefined): BackendState {
  const s = (state || '').toLowerCase() as UIState;
  return toBackendMap[s] ?? 'coleta';
}

// Transições válidas (backend)
const transitions: Record<BackendState, BackendState[]> = {
  coleta: ['analise'],
  analise: ['diagnostico', 'coleta'],
  diagnostico: ['recomendacao', 'analise'],
  recomendacao: ['execucao', 'diagnostico'],
  execucao: ['concluido', 'recomendacao'],
  concluido: []
};

export function canTransition(fromState: string, toState: string): boolean {
  const fromB = normalizeToBackend(fromState);
  const toB = normalizeToBackend(toState);
  return transitions[fromB]?.includes(toB) ?? false;
}
