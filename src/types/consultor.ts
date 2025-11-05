export type EtapaJornada = 'anamnese' | 'mapeamento' | 'priorizacao' | 'execucao';
export type EtapaArea = 'aguardando' | 'as_is' | 'analise' | 'plano' | 'execucao' | 'concluida';
export type StatusAcao = 'a_fazer' | 'em_andamento' | 'bloqueado' | 'concluido';
export type StatusKanban = 'todo' | 'in_progress' | 'blocked' | 'done';
export type StatusAprovacao = 'rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'rejeitado';
export type TipoEntregavel = 'anamnese' | 'mapa_geral' | 'mapa_area' | 'bpmn' | 'diagnostico' | 'plano_acao';
export type Prioridade = 'alta' | 'media' | 'baixa';
export type OrigemHistorico = 'manual' | 'agente_executor';

export interface JornadaConsultor {
  id: string;
  user_id: string;
  empresa_nome: string;
  etapa_atual: EtapaJornada;
  dados_anamnese: DadosAnamnese;
  areas_priorizadas: AreaPriorizada[];
  progresso_geral: number;
  conversation_id?: string;
  contexto_coleta?: ContextoColetado;
  resumo_etapa?: ResumoEtapa;
  processos_escopo?: ProcessoEscopo[];
  created_at: string;
  updated_at: string;
}

export interface DadosAnamnese {
  usuario: {
    nome?: string;
    cargo?: string;
    experiencia?: string;
    objetivos_pessoais?: string;
  };
  empresa: {
    nome?: string;
    segmento?: string;
    porte?: string;
    tempo_mercado?: string;
    faturamento?: string;
    tamanho_equipe?: string;
  };
  expectativas: {
    desafios_principais?: string[];
    metas_curto_prazo?: string[];
    metas_medio_prazo?: string[];
    metas_longo_prazo?: string[];
  };
}

export interface AreaPriorizada {
  nome: string;
  posicao: number;
  justificativa?: string;
  impacto?: number;
  urgencia?: number;
  facilidade?: number;
}

export interface AreaTrabalho {
  id: string;
  jornada_id: string;
  nome_area: string;
  posicao_prioridade: number;
  etapa_area: EtapaArea;
  pode_iniciar: boolean;
  bloqueada_por?: string;
  progresso_area: number;
  processos_mapeados_ids?: string[];
  processo_atual?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessoMapeado {
  id: string;
  area_id: string;
  nome_processo: string;
  input: string;
  output: string;
  ferramentas: string;
  metricas: string;
  regras: string;
  fluxo_trabalho: string;
  pessoas: string;
  fluxo_bpmn_xml: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticoArea {
  id: string;
  area_id: string;
  conteudo_diagnostico: ConteudoDiagnostico;
  status_aprovacao: StatusAprovacao;
  versao: number;
  data_aprovacao?: string;
  created_at: string;
  updated_at: string;
}

export interface ConteudoDiagnostico {
  pontos_fortes?: string[];
  gaps_criticos?: string[];
  riscos?: string[];
  oportunidades?: string[];
  comparacao_mercado?: string;
  resumo_executivo?: string;
}

export interface AcaoPlano {
  id: string;
  area_id: string;
  what: string;
  why: string;
  where_field: string;
  when_field?: string;
  who: string;
  how: string;
  how_much: string;
  status: StatusAcao;
  progresso: number;
  evidencias: Evidencia[];
  prioridade: Prioridade;
  ordem_kanban: number;
  created_at: string;
  updated_at: string;
}

export interface Evidencia {
  tipo: 'upload' | 'link' | 'nota';
  conteudo: string;
  data: string;
}

export interface EntregavelConsultor {
  id: string;
  jornada_id: string;
  area_id?: string;
  nome: string;
  tipo: TipoEntregavel;
  html_conteudo: string;
  etapa_origem: string;
  template_usado_id?: string;
  data_geracao: string;
  visualizado?: boolean;
  created_at: string;
}

export interface GamificacaoConsultor {
  id: string;
  user_id: string;
  xp_total: number;
  nivel: number;
  conquistas: Conquista[];
  dias_consecutivos: number;
  areas_completadas: number;
  ultimo_acesso: string;
  created_at: string;
  updated_at: string;
}

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  data_desbloqueio: string;
  xp_ganho: number;
}

export interface ChatAcao {
  id: string;
  acao_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadados: Record<string, any>;
  created_at: string;
}

export interface ContextoConsultor {
  jornada?: JornadaConsultor;
  area_atual?: AreaTrabalho;
  processos?: ProcessoMapeado[];
  diagnostico?: DiagnosticoArea;
  acoes?: AcaoPlano[];
  entregaveis?: EntregavelConsultor[];
  gamificacao?: GamificacaoConsultor;
}

export interface ContextoColetado {
  nome_usuario?: string;
  cargo?: string;
  empresa_nome?: string;
  segmento?: string;
  porte?: string;
  tempo_mercado?: string;
  desafios_principais?: string[];
  metas_curto_prazo?: string[];
  metas_medio_prazo?: string[];
  metas_longo_prazo?: string[];
  areas_mapeadas?: AreaMapeada[];
  areas_priorizadas?: AreaPriorizadaCompleta[];
  [key: string]: any;
}

export interface ResumoEtapa {
  etapa: string;
  informacoes_coletadas: string[];
  perguntas_respondidas: string[];
  confianca_avanco: number;
  proximos_passos?: string;
  [key: string]: any;
}

export interface ProcessoEscopo {
  nome: string;
  area: string;
  prioridade: number;
  descricao?: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
}

export interface AreaMapeada {
  nome: string;
  existe: boolean;
  responsavel?: string;
  principais_atividades?: string;
  ferramentas?: string[];
  desafios?: string[];
}

export interface AreaPriorizadaCompleta extends AreaPriorizada {
  processos_principais?: string[];
  pode_executar_paralelo?: boolean;
}

export interface KanbanCard {
  id: string;
  jornada_id: string;
  sessao_id?: string;
  area_id?: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  responsavel_id?: string;
  prazo: string;
  status: StatusKanban;
  ordem: number;
  dados_5w2h: {
    o_que?: string;
    por_que?: string;
    quem?: string;
    quando?: string;
    onde?: string;
    como?: string;
    quanto?: string;
  };
  observacoes?: string;
  tags?: string[];
  prioridade: Prioridade;
  data_conclusao?: string;
  progresso: number;
  created_at: string;
  updated_at: string;
}

export interface AcaoAnexo {
  id: string;
  acao_id: string;
  nome_arquivo: string;
  storage_path: string;
  tipo_mime: string;
  tamanho_bytes: number;
  descricao?: string;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  jornada_id: string;
  nome_arquivo: string;
  storage_path: string;
  tipo_mime: string;
  tamanho_bytes: number;
  contexto?: string;
  uploaded_by: string;
  created_at: string;
}

export interface AcaoHistorico {
  id: string;
  acao_id: string;
  campo_alterado: string;
  valor_anterior?: string;
  valor_novo?: string;
  alterado_por: string;
  origem: OrigemHistorico;
  created_at: string;
}

export interface ProjectKPIs {
  total_acoes: number;
  acoes_concluidas: number;
  acoes_pendentes: number;
  acoes_em_andamento: number;
  acoes_bloqueadas: number;
  acoes_por_responsavel: Record<string, number>;
  acoes_por_processo: Record<string, number>;
  taxa_conclusao: number;
  acoes_atrasadas: number;
}
