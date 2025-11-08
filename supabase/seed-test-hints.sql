/*
  Seed de Hints de Teste para Sistema Proceda

  Este arquivo contém hints reais baseados em situações comuns
  de consultoria empresarial para popular o catálogo e permitir
  testes do sistema de busca semântica.
*/

-- Limpar hints existentes de teste (opcional)
-- DELETE FROM proceda_hints WHERE tags @> ARRAY['teste'];

-- ECOMMERCE / VAREJO ONLINE

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'E-commerce sem tráfego pago',
  ARRAY['ecommerce', 'varejo_online', 'loja_online'],
  ARRAY['marketing', 'vendas'],
  'e-commerce, loja online, site de vendas, vende pela internet, sem tráfego pago, sem Ads, sem investimento em marketing digital, só orgânico, depende de rede social orgânica, baixo volume de visitas, poucas vendas online',
  'Estruturar campanhas de mídia paga (Google Ads + Meta Ads) | Criar funil de conversão com landing pages otimizadas | Implementar remarketing para carrinho abandonado | Definir orçamento inicial e CAC alvo',
  8,
  ARRAY['teste', 'marketing_digital', 'performance'],
  'Situação muito comum em e-commerces iniciantes'
),
(
  'Alta taxa de abandono de carrinho',
  ARRAY['ecommerce', 'varejo_online'],
  ARRAY['vendas', 'marketing'],
  'carrinho abandonado, cliente adiciona produto mas não compra, abandona no checkout, desiste da compra, taxa de conversão baixa no checkout, perde venda no último passo',
  'Implementar sequência de e-mail de recuperação de carrinho | Simplificar processo de checkout (menos etapas) | Oferecer frete grátis acima de X | Adicionar prova social e selos de segurança | Testar checkout em uma página',
  9,
  ARRAY['teste', 'cx', 'conversao'],
  'Impacto direto na receita'
),
(
  'Logística e estoque desorganizados',
  ARRAY['ecommerce', 'varejo_fisico', 'varejo_online'],
  ARRAY['logistica', 'operacoes'],
  'estoque desorganizado, não sabe o que tem em estoque, ruptura frequente, demora para separar pedidos, produtos sem controle, inventário desatualizado, picking demorado, atrasos nas entregas',
  'Implementar sistema WMS ou controle de estoque digital | Definir endereçamento de produtos (picking eficiente) | Estabelecer ponto de pedido e estoque de segurança | Criar processo de inventário rotativo',
  7,
  ARRAY['teste', 'processos', 'eficiencia'],
  'Base para crescimento escalável'
);

-- SAAS / TECNOLOGIA

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'SaaS com alta rotatividade de clientes',
  ARRAY['saas', 'tecnologia', 'software'],
  ARRAY['vendas', 'rh', 'marketing'],
  'churn alto, clientes cancelam assinatura, rotatividade de clientes, perda de clientes recorrentes, renovação baixa, cancela depois de poucos meses, não vê valor no produto',
  'Implementar onboarding estruturado nos primeiros 30 dias | Criar programa de customer success com check-ins regulares | Desenvolver materiais educacionais (academy) | Mapear jornada do cliente e identificar momentos críticos | Implementar NPS e pesquisa de cancelamento',
  10,
  ARRAY['teste', 'retencao', 'customer_success'],
  'Churn é métrica crítica em SaaS'
),
(
  'Produto complexo com baixa adoção',
  ARRAY['saas', 'tecnologia'],
  ARRAY['marketing', 'vendas', 'operacoes'],
  'produto difícil de usar, cliente não usa todas funcionalidades, baixa adoção, time-to-value longo, curva de aprendizado alta, interface confusa, necessita muito treinamento',
  'Simplificar interface priorizando casos de uso principais | Criar tours guiados in-app (tooltips interativos) | Desenvolver base de conhecimento com vídeos curtos | Implementar progressive disclosure (mostrar funcionalidades aos poucos) | Oferecer quick wins logo no início',
  8,
  ARRAY['teste', 'ux', 'produto'],
  'Time-to-value é crítico para retenção'
);

-- CONSULTORIA / SERVIÇOS

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'Consultoria sem processo de prospecção',
  ARRAY['servicos', 'consultoria', 'agencia'],
  ARRAY['vendas', 'marketing'],
  'depende de indicação, sem prospecção ativa, espera cliente chegar, marketing passivo, rede de contatos limitada, crescimento irregular, falta pipeline comercial estruturado',
  'Definir ICP (cliente ideal) e listar empresas alvo | Criar estratégia de conteúdo no LinkedIn (thought leadership) | Implementar outbound via LinkedIn e e-mail frio | Participar de eventos e comunidades do setor | Desenvolver cases de sucesso documentados',
  9,
  ARRAY['teste', 'outbound', 'posicionamento'],
  'Consultoria precisa de pipeline previsível'
),
(
  'Precificação por hora gera teto de receita',
  ARRAY['servicos', 'consultoria', 'agencia'],
  ARRAY['financeiro', 'vendas'],
  'cobra por hora, não consegue escalar receita, teto de faturamento, hora limitada, tempo versus dinheiro, não consegue aumentar preço, cliente questiona horas trabalhadas',
  'Migrar para precificação baseada em valor entregue | Criar pacotes de serviço com escopo fixo | Desenvolver produtos de prateleira (frameworks, templates) | Implementar modelo de retainer mensal | Criar modelo híbrido com componentes recorrentes',
  8,
  ARRAY['teste', 'pricing', 'escalabilidade'],
  'Precificação por hora limita crescimento'
);

-- INDÚSTRIA / MANUFATURA

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'Alta taxa de defeitos e retrabalho',
  ARRAY['industria', 'producao', 'manufatura'],
  ARRAY['qualidade', 'operacoes'],
  'muitos defeitos, produtos com problema, retrabalho frequente, refugo alto, não conformidades, cliente reclama de qualidade, inspeção reprova lotes, perda de material',
  'Implementar inspeção em múltiplos pontos do processo | Aplicar metodologia DMAIC para causas raiz dos defeitos | Criar poka-yokes (à prova de erros) nas operações críticas | Treinar operadores em qualidade e padrões | Implementar CEP (Controle Estatístico de Processo)',
  9,
  ARRAY['teste', 'qualidade', 'six_sigma'],
  'Qualidade impacta margem e reputação'
),
(
  'Gargalo de produção limitando capacidade',
  ARRAY['industria', 'producao'],
  ARRAY['operacoes', 'financeiro'],
  'não consegue atender demanda, gargalo na produção, uma máquina limita tudo, processo lento, capacidade insuficiente, fila de pedidos, lead time longo, setup demorado',
  'Mapear processo e identificar gargalo (Teoria das Restrições) | Otimizar recurso gargalo: maximizar uptime, reduzir setup, eliminar paradas | Balancear carga: redistribuir tarefas para outros recursos | Investir em capacidade adicional no gargalo | Implementar buffer estratégico antes do gargalo',
  10,
  ARRAY['teste', 'toc', 'capacidade'],
  'Gargalo define capacidade total do sistema'
);

-- VAREJO FÍSICO

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'Loja física com movimento mas baixo ticket',
  ARRAY['varejo_fisico', 'loja'],
  ARRAY['vendas', 'marketing'],
  'tem cliente mas vende pouco, ticket médio baixo, cliente olha e não compra, conversão baixa na loja, movimento bom mas faturamento fraco, vendedor não aborda cliente',
  'Treinar vendedores em abordagem consultiva e upsell | Criar estratégias de cross-sell e combos | Implementar programa de fidelidade para aumentar recorrência | Revisar layout e exposição de produtos (merchandising) | Definir metas de ticket médio por vendedor',
  8,
  ARRAY['teste', 'vendas', 'treinamento'],
  'Ticket médio é alavanca de crescimento'
),
(
  'Alta rotatividade de vendedores',
  ARRAY['varejo_fisico', 'loja', 'servicos'],
  ARRAY['rh', 'vendas'],
  'funcionário sai rápido, turnover alto, vendedor não fica, precisa treinar sempre gente nova, clima ruim, desmotivação, saída constante de talentos, custo de recontratação',
  'Revisar pacote de remuneração e comissionamento | Criar plano de carreira claro e transparente | Implementar programa de reconhecimento e gamificação | Melhorar processo de onboarding e treinamento inicial | Fazer entrevistas de desligamento e agir nos feedbacks',
  7,
  ARRAY['teste', 'retencao_talentos', 'cultura'],
  'Turnover impacta custos e performance'
);

-- PROBLEMAS TRANSVERSAIS

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, tags, notas) VALUES
(
  'Gestão sem indicadores',
  ARRAY['ecommerce', 'saas', 'servicos', 'industria', 'varejo_fisico'],
  ARRAY['gestao', 'financeiro'],
  'não tem KPI, não mede resultado, gestão no achismo, não sabe se melhorou, sem dashboard, sem controle gerencial, decisão baseada em sensação, não tem números',
  'Definir KPIs principais por área (máximo 3-5 por área) | Criar dashboard simples e visual (Excel ou ferramenta de BI) | Estabelecer rotina de revisão semanal de indicadores | Definir metas para cada KPI com prazo | Treinar gestores em análise de dados',
  10,
  ARRAY['teste', 'kpi', 'data_driven'],
  'Gestão sem números é gestão às cegas'
),
(
  'Fluxo de caixa apertado constantemente',
  ARRAY['ecommerce', 'saas', 'servicos', 'industria', 'varejo_fisico'],
  ARRAY['financeiro', 'operacoes'],
  'falta dinheiro no caixa, capital de giro insuficiente, sempre apertado para pagar contas, inadimplência, paga fornecedor atrasado, depende de empréstimo, ciclo financeiro negativo',
  'Mapear ciclo de conversão de caixa (PMR + PME - PMP) | Negociar prazos: reduzir PMR e aumentar PMP | Reduzir estoque ocioso ou lento | Criar projeção de fluxo de caixa 90 dias | Estabelecer reserva de emergência mínima | Renegociar dívidas caras',
  10,
  ARRAY['teste', 'liquidez', 'working_capital'],
  'Fluxo de caixa é oxigênio da empresa'
);

-- Atualizar contadores
UPDATE proceda_hints SET uso_count = 0, aceite_count = 0 WHERE tags @> ARRAY['teste'];

-- Resumo
SELECT
  COUNT(*) as total_hints,
  COUNT(*) FILTER (WHERE prioridade >= 8) as alta_prioridade,
  array_agg(DISTINCT s) as segmentos_cobertos,
  array_agg(DISTINCT d) as dominios_cobertos
FROM proceda_hints, unnest(segmentos) s, unnest(dominios) d
WHERE tags @> ARRAY['teste'];
