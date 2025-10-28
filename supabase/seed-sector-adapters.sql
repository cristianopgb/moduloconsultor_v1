-- ================================================
-- SEED: Adapters por Setor - Carga em Massa
-- ================================================
-- Este arquivo popula a tabela sector_adapters com
-- adaptadores específicos para diversos setores empresariais
-- ================================================

-- Limpar dados anteriores (apenas em desenvolvimento)
-- TRUNCATE TABLE sector_adapters CASCADE;

-- ====================
-- INDÚSTRIA E MANUFATURA
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Indústria e Manufatura',
  'Fábricas, produção industrial, manufatura',
  '[
    {"nome": "OEE (Overall Equipment Effectiveness)", "descricao": "Eficiência geral dos equipamentos", "formula": "Disponibilidade × Performance × Qualidade", "meta_ideal": "> 85%"},
    {"nome": "Lead Time de Produção", "descricao": "Tempo total de produção", "formula": "Data Entrega - Data Início Produção", "meta_ideal": "Redução contínua"},
    {"nome": "Refugo/Scrap", "descricao": "% de produtos defeituosos", "formula": "(Unidades Defeituosas / Total Produzido) × 100", "meta_ideal": "< 2%"},
    {"nome": "OTIF (On Time In Full)", "descricao": "Entregas no prazo e completas", "formula": "(Pedidos OTIF / Total Pedidos) × 100", "meta_ideal": "> 95%"}
  ]'::jsonb,
  '[
    {"campo": "tipo_producao", "pergunta": "Qual o tipo de produção?", "tipo": "select", "opcoes": ["Make to Stock (MTS)", "Make to Order (MTO)", "Engineer to Order (ETO)", "Assembly to Order (ATO)"]},
    {"campo": "num_linhas_producao", "pergunta": "Quantas linhas de produção possui?", "tipo": "number"},
    {"campo": "capacidade_producao", "pergunta": "Qual a capacidade produtiva mensal?", "tipo": "text"},
    {"campo": "turnos_trabalho", "pergunta": "Quantos turnos de trabalho?", "tipo": "select", "opcoes": ["1 turno", "2 turnos", "3 turnos", "Ininterrupto"]},
    {"campo": "certificacoes", "pergunta": "Possui certificações? (ISO 9001, ISO 14001, etc)", "tipo": "text"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Cadeia de Valor', '5 Porquês', 'Matriz de Priorização'],
  ARRAY[
    'Setup longo de máquinas',
    'Quebras e manutenções não planejadas',
    'Gargalos na produção',
    'Falta de matéria-prima',
    'Qualidade inconsistente',
    'Desperdício de materiais',
    'Baixa produtividade',
    'Gestão de manutenção preventiva'
  ],
  ARRAY['Plano de Manutenção Preventiva', 'Mapeamento de Fluxo de Valor (VSM)', 'Plano de Redução de Refugo', 'Layout de Fábrica'],
  ARRAY['industria', 'manufatura', 'producao', 'fabrica', 'lean'],
  10
) ON CONFLICT DO NOTHING;

-- ====================
-- SAÚDE
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Saúde',
  'Clínicas, hospitais, consultórios, laboratórios',
  '[
    {"nome": "Taxa de Ocupação", "descricao": "% de leitos ou salas ocupados", "formula": "(Leitos Ocupados / Total Leitos) × 100", "meta_ideal": "75-85%"},
    {"nome": "Tempo Médio de Espera", "descricao": "Tempo que paciente aguarda atendimento", "formula": "Soma Tempos de Espera / Número de Pacientes", "meta_ideal": "< 30 minutos"},
    {"nome": "No-Show Rate", "descricao": "Taxa de faltas em consultas", "formula": "(Consultas Faltadas / Total Agendadas) × 100", "meta_ideal": "< 10%"},
    {"nome": "Net Promoter Score (NPS)", "descricao": "Satisfação do paciente", "formula": "% Promotores - % Detratores", "meta_ideal": "> 70"}
  ]'::jsonb,
  '[
    {"campo": "tipo_estabelecimento", "pergunta": "Tipo de estabelecimento?", "tipo": "select", "opcoes": ["Consultório", "Clínica", "Hospital", "Laboratório", "Centro Diagnóstico", "Pronto Atendimento"]},
    {"campo": "especialidades", "pergunta": "Quais especialidades atende?", "tipo": "text"},
    {"campo": "num_profissionais", "pergunta": "Quantos profissionais de saúde?", "tipo": "number"},
    {"campo": "atendimentos_dia", "pergunta": "Média de atendimentos por dia?", "tipo": "number"},
    {"campo": "sistema_gestao", "pergunta": "Usa sistema de gestão? Qual?", "tipo": "text"}
  ]'::jsonb,
  ARRAY['SIPOC', '5W2H', 'Matriz de Priorização', 'Business Model Canvas'],
  ARRAY[
    'Longa fila de espera',
    'Alta taxa de no-show',
    'Baixa produtividade médica',
    'Gestão de agenda ineficiente',
    'Processos administrativos lentos',
    'Falta de integração de sistemas',
    'Experiência do paciente ruim',
    'Glosas de convênios'
  ],
  ARRAY['Protocolo de Atendimento', 'Fluxo de Agendamento Otimizado', 'Plano de Redução de No-Show', 'SLA de Atendimento'],
  ARRAY['saude', 'clinica', 'hospital', 'medicina', 'atendimento'],
  9
) ON CONFLICT DO NOTHING;

-- ====================
-- EDUCAÇÃO
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Educação',
  'Escolas, cursos, universidades, treinamentos',
  '[
    {"nome": "Taxa de Evasão", "descricao": "% de alunos que abandonam", "formula": "(Alunos Evadidos / Total Matriculados) × 100", "meta_ideal": "< 10%"},
    {"nome": "NPS - Net Promoter Score", "descricao": "Satisfação dos alunos", "formula": "% Promotores - % Detratores", "meta_ideal": "> 60"},
    {"nome": "Taxa de Conversão", "descricao": "% de leads que matriculam", "formula": "(Matrículas / Leads) × 100", "meta_ideal": "> 20%"},
    {"nome": "LTV/CAC Ratio", "descricao": "Retorno sobre custo de aquisição", "formula": "Lifetime Value / Customer Acquisition Cost", "meta_ideal": "> 3:1"}
  ]'::jsonb,
  '[
    {"campo": "tipo_ensino", "pergunta": "Tipo de ensino oferecido?", "tipo": "select", "opcoes": ["Presencial", "Online", "Híbrido"]},
    {"campo": "nivel_ensino", "pergunta": "Nível de ensino?", "tipo": "multiselect", "opcoes": ["Fundamental", "Médio", "Superior", "Pós-graduação", "Cursos Livres", "Técnico"]},
    {"campo": "num_alunos", "pergunta": "Quantos alunos ativos?", "tipo": "number"},
    {"campo": "ticket_medio", "pergunta": "Mensalidade/ticket médio?", "tipo": "number"},
    {"campo": "plataforma_ensino", "pergunta": "Usa plataforma de ensino? Qual?", "tipo": "text"}
  ]'::jsonb,
  ARRAY['Business Model Canvas', '5W2H', 'SIPOC', 'Matriz de Priorização'],
  ARRAY[
    'Alta taxa de evasão',
    'Baixa conversão de leads',
    'Inadimplência elevada',
    'Dificuldade de escalar',
    'Engajamento dos alunos',
    'Qualidade do conteúdo',
    'Gestão de professores',
    'Concorrência acirrada'
  ],
  ARRAY['Plano de Retenção de Alunos', 'Funil de Conversão Otimizado', 'Jornada do Aluno', 'Grade Curricular'],
  ARRAY['educacao', 'escola', 'curso', 'ensino', 'treinamento'],
  8
) ON CONFLICT DO NOTHING;

-- ====================
-- ALIMENTAÇÃO (Restaurantes/Bares)
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Alimentação',
  'Restaurantes, bares, lanchonetes, food service',
  '[
    {"nome": "CMV (Custo Mercadoria Vendida)", "descricao": "% do custo dos ingredientes", "formula": "(Custo Ingredientes / Faturamento) × 100", "meta_ideal": "28-35%"},
    {"nome": "Ticket Médio", "descricao": "Valor médio por cliente", "formula": "Faturamento / Número de Clientes", "meta_ideal": "Crescimento constante"},
    {"nome": "Taxa de Ocupação", "descricao": "% de mesas ocupadas", "formula": "(Mesas Ocupadas / Total Mesas) × 100", "meta_ideal": "> 70%"},
    {"nome": "Turnover de Mesa", "descricao": "Quantas vezes mesa é ocupada", "formula": "Total Atendimentos / Número de Mesas", "meta_ideal": "> 3x por turno"}
  ]'::jsonb,
  '[
    {"campo": "tipo_estabelecimento", "pergunta": "Tipo de estabelecimento?", "tipo": "select", "opcoes": ["Restaurante", "Bar", "Lanchonete", "Cafeteria", "Food Truck", "Delivery", "Catering"]},
    {"campo": "capacidade_lugares", "pergunta": "Capacidade de lugares?", "tipo": "number"},
    {"campo": "horario_funcionamento", "pergunta": "Horário de funcionamento?", "tipo": "text"},
    {"campo": "faz_delivery", "pergunta": "Trabalha com delivery?", "tipo": "select", "opcoes": ["Sim, próprio", "Sim, por apps", "Ambos", "Não"]},
    {"campo": "num_funcionarios", "pergunta": "Quantos funcionários?", "tipo": "number"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Cadeia de Valor', '5W2H', '5 Porquês'],
  ARRAY[
    'CMV alto (desperdício)',
    'Falta de padronização de receitas',
    'Rotatividade de funcionários',
    'Gestão de estoque deficiente',
    'Tempo de preparo longo',
    'Baixo ticket médio',
    'Fluxo de caixa irregular',
    'Sazonalidade'
  ],
  ARRAY['Ficha Técnica de Pratos', 'Plano de Redução de CMV', 'Manual de Procedimentos', 'Cardápio Engenhado'],
  ARRAY['alimentacao', 'restaurante', 'bar', 'food-service', 'gastronomia'],
  7
) ON CONFLICT DO NOTHING;

-- ====================
-- CONSTRUÇÃO CIVIL
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Construção Civil',
  'Construtoras, incorporadoras, reformas',
  '[
    {"nome": "Desvio de Orçamento", "descricao": "% desvio entre previsto e real", "formula": "((Custo Real - Custo Previsto) / Custo Previsto) × 100", "meta_ideal": "< 5%"},
    {"nome": "Desvio de Prazo", "descricao": "% atraso na entrega", "formula": "((Prazo Real - Prazo Previsto) / Prazo Previsto) × 100", "meta_ideal": "< 10%"},
    {"nome": "Índice de Retrabalho", "descricao": "% de trabalho refeito", "formula": "(Horas Retrabalho / Total Horas) × 100", "meta_ideal": "< 5%"},
    {"nome": "VGV (Valor Geral de Vendas)", "descricao": "Valor total do empreendimento", "formula": "Soma de todas unidades × preço", "meta_ideal": "Depende do projeto"}
  ]'::jsonb,
  '[
    {"campo": "tipo_obra", "pergunta": "Tipo de obra/construção?", "tipo": "multiselect", "opcoes": ["Residencial", "Comercial", "Industrial", "Reforma", "Infraestrutura"]},
    {"campo": "num_obras_simultaneas", "pergunta": "Quantas obras simultâneas?", "tipo": "number"},
    {"campo": "metodologia_gestao", "pergunta": "Usa metodologia de gestão? Qual?", "tipo": "select", "opcoes": ["PMBOK", "PRINCE2", "Lean Construction", "Nenhuma formal"]},
    {"campo": "software_gestao", "pergunta": "Software de gestão de obras?", "tipo": "text"},
    {"campo": "num_colaboradores", "pergunta": "Quantos colaboradores diretos?", "tipo": "number"}
  ]'::jsonb,
  ARRAY['5W2H', 'SIPOC', '5 Porquês', 'Matriz de Priorização'],
  ARRAY[
    'Atrasos frequentes',
    'Estouro de orçamento',
    'Baixa produtividade',
    'Retrabalho constante',
    'Gestão de subempreiteiros',
    'Falta de material',
    'Segurança no trabalho',
    'Qualidade inconsistente'
  ],
  ARRAY['Cronograma de Obra Otimizado', 'Orçamento Detalhado', 'Plano de Qualidade', 'Gestão de Riscos'],
  ARRAY['construcao', 'obras', 'engenharia', 'construtora'],
  7
) ON CONFLICT DO NOTHING;

-- ====================
-- LOGÍSTICA E TRANSPORTES
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Logística e Transportes',
  'Transportadoras, entregas, armazenagem, distribuição',
  '[
    {"nome": "OTIF (On Time In Full)", "descricao": "Entregas no prazo e completas", "formula": "(Entregas OTIF / Total Entregas) × 100", "meta_ideal": "> 95%"},
    {"nome": "Custo por Km Rodado", "descricao": "Custo operacional por km", "formula": "Custos Totais / Total Km Rodados", "meta_ideal": "Redução contínua"},
    {"nome": "Taxa de Ocupação de Frota", "descricao": "% da capacidade utilizada", "formula": "(Peso Transportado / Capacidade Total) × 100", "meta_ideal": "> 80%"},
    {"nome": "Avarias", "descricao": "% de produtos avariados", "formula": "(Produtos Avariados / Total Transportado) × 100", "meta_ideal": "< 1%"}
  ]'::jsonb,
  '[
    {"campo": "tipo_operacao", "pergunta": "Tipo de operação?", "tipo": "multiselect", "opcoes": ["Transporte Rodoviário", "Armazenagem", "Distribuição Urbana", "Last Mile", "Cross Docking"]},
    {"campo": "tamanho_frota", "pergunta": "Tamanho da frota? (própria + terceirizada)", "tipo": "text"},
    {"campo": "area_atuacao", "pergunta": "Área de atuação?", "tipo": "select", "opcoes": ["Local", "Regional", "Nacional", "Internacional"]},
    {"campo": "sistema_roteirizacao", "pergunta": "Usa sistema de roteirização?", "tipo": "select", "opcoes": ["Sim", "Não", "Manual"]},
    {"campo": "tipo_carga", "pergunta": "Tipo de carga predominante?", "tipo": "text"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Cadeia de Valor', '5 Porquês', 'Matriz de Priorização'],
  ARRAY[
    'Rotas não otimizadas',
    'Alto custo de combustível',
    'Ociosidade de veículos',
    'Atrasos recorrentes',
    'Avarias e perdas',
    'Falta de rastreamento',
    'Gestão de motoristas',
    'Manutenção de frota'
  ],
  ARRAY['Plano de Roteirização', 'Matriz de Custos Logísticos', 'SLA de Entregas', 'Gestão de Frota'],
  ARRAY['logistica', 'transportes', 'entregas', 'distribuicao'],
  6
) ON CONFLICT DO NOTHING;

-- ====================
-- AGRONEGÓCIO
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Agronegócio',
  'Fazendas, produção agrícola, pecuária, agroindústria',
  '[
    {"nome": "Produtividade por Hectare", "descricao": "Produção por área cultivada", "formula": "Total Produzido / Hectares Plantados", "meta_ideal": "Depende da cultura"},
    {"nome": "Custo de Produção", "descricao": "Custo por unidade produzida", "formula": "Custos Totais / Volume Produzido", "meta_ideal": "Abaixo preço de mercado"},
    {"nome": "Taxa de Mortalidade (Pecuária)", "descricao": "% de animais perdidos", "formula": "(Animais Mortos / Total Rebanho) × 100", "meta_ideal": "< 2%"},
    {"nome": "Eficiência no Uso de Água", "descricao": "Litros por kg produzido", "formula": "Volume Água Utilizada / Volume Produzido", "meta_ideal": "Redução contínua"}
  ]'::jsonb,
  '[
    {"campo": "tipo_producao", "pergunta": "Tipo de produção?", "tipo": "multiselect", "opcoes": ["Agricultura", "Pecuária", "Avicultura", "Suinocultura", "Fruticultura", "Silvicultura"]},
    {"campo": "area_total", "pergunta": "Área total da propriedade (hectares)?", "tipo": "number"},
    {"campo": "culturas_principais", "pergunta": "Principais culturas/criações?", "tipo": "text"},
    {"campo": "nivel_tecnologia", "pergunta": "Nível de tecnificação?", "tipo": "select", "opcoes": ["Baixo (manual)", "Médio (semi-mecanizado)", "Alto (totalmente mecanizado)", "Agricultura 4.0"]},
    {"campo": "certificacoes", "pergunta": "Possui certificações? (Orgânico, Rainforest, etc)", "tipo": "text"}
  ]'::jsonb,
  ARRAY['SIPOC', 'Cadeia de Valor', '5W2H', '5 Porquês'],
  ARRAY[
    'Baixa produtividade',
    'Alto custo de produção',
    'Dependência climática',
    'Gestão de pragas e doenças',
    'Comercialização desfavorável',
    'Falta de planejamento de safra',
    'Gestão financeira deficiente',
    'Sucessão familiar'
  ],
  ARRAY['Plano de Safra', 'Custeio Agrícola', 'Manejo Integrado de Pragas', 'Análise de Solo e Adubação'],
  ARRAY['agro', 'agricultura', 'pecuaria', 'fazenda', 'rural'],
  6
) ON CONFLICT DO NOTHING;

-- ====================
-- HOTELARIA E TURISMO
-- ====================
INSERT INTO sector_adapters (
  setor_nome,
  setor_descricao,
  kpis,
  perguntas_anamnese,
  metodologias_recomendadas,
  problemas_comuns,
  entregaveis_tipicos,
  tags,
  prioridade
) VALUES (
  'Hotelaria e Turismo',
  'Hotéis, pousadas, resorts, agências de viagem',
  '[
    {"nome": "Taxa de Ocupação", "descricao": "% de quartos ocupados", "formula": "(Quartos Ocupados / Total Quartos) × 100", "meta_ideal": "> 70%"},
    {"nome": "RevPAR", "descricao": "Revenue per Available Room", "formula": "Receita de Hospedagem / Total Quartos Disponíveis", "meta_ideal": "Crescimento constante"},
    {"nome": "ADR (Average Daily Rate)", "descricao": "Diária média", "formula": "Receita de Hospedagem / Quartos Ocupados", "meta_ideal": "Acima da concorrência"},
    {"nome": "NPS - Net Promoter Score", "descricao": "Satisfação do hóspede", "formula": "% Promotores - % Detratores", "meta_ideal": "> 70"}
  ]'::jsonb,
  '[
    {"campo": "tipo_estabelecimento", "pergunta": "Tipo de estabelecimento?", "tipo": "select", "opcoes": ["Hotel", "Pousada", "Resort", "Hostel", "Flat", "Agência de Viagem"]},
    {"campo": "num_quartos", "pergunta": "Número de quartos/UHs?", "tipo": "number"},
    {"campo": "classificacao", "pergunta": "Classificação? (estrelas)", "tipo": "select", "opcoes": ["1 estrela", "2 estrelas", "3 estrelas", "4 estrelas", "5 estrelas", "Boutique", "Econômico"]},
    {"campo": "canais_venda", "pergunta": "Canais de venda?", "tipo": "multiselect", "opcoes": ["Site Próprio", "Booking", "Airbnb", "Expedia", "Agências", "Direto"]},
    {"campo": "publico_alvo", "pergunta": "Público-alvo principal?", "tipo": "select", "opcoes": ["Lazer", "Negócios", "Eventos", "Misto"]}
  ]'::jsonb,
  ARRAY['Business Model Canvas', 'SIPOC', '5W2H', 'Matriz de Priorização'],
  ARRAY[
    'Baixa taxa de ocupação',
    'Sazonalidade alta',
    'Diária média baixa',
    'Dependência de OTAs',
    'Custos operacionais altos',
    'Gestão de reservas ineficiente',
    'Avaliações negativas online',
    'Rotatividade de funcionários'
  ],
  ARRAY['Estratégia de Revenue Management', 'Plano de Marketing Digital', 'Protocolo de Atendimento', 'Gestão de Reputação Online'],
  ARRAY['hotel', 'turismo', 'hospedagem', 'pousada'],
  5
) ON CONFLICT DO NOTHING;

-- Verificar total de adapters inseridos
SELECT
  COUNT(*) as total_adapters,
  COUNT(*) FILTER (WHERE ativo = true) as adapters_ativos
FROM sector_adapters;

-- Listar todos os setores disponíveis
SELECT
  setor_nome,
  prioridade,
  array_length(tags, 1) as num_tags,
  jsonb_array_length(kpis) as num_kpis,
  ativo
FROM sector_adapters
ORDER BY prioridade DESC, setor_nome;
