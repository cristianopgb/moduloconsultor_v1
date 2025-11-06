/*
  Seed inicial da base de conhecimento Proceda Hints
  20-30 situações validadas com recomendações cirúrgicas
*/

INSERT INTO proceda_hints (title, segmentos, dominios, scenario, recommendations, prioridade, versao, tags) VALUES

-- E-COMMERCE / VAREJO ONLINE
(
  'E-commerce sem tráfego pago',
  ARRAY['ecommerce', 'varejo_online', 'loja_online'],
  ARRAY['marketing', 'vendas'],
  'e-commerce, loja online, site de vendas, vende pela internet, sem tráfego pago, sem Ads, sem Google Ads, sem Meta Ads, sem Facebook Ads, sem Instagram Ads, só orgânico, dependente de orgânico, sem investimento em marketing digital, baixo volume de visitas',
  'Estruturar campanhas de mídia paga escaláveis (Google Ads Shopping + Meta Ads dinâmicos) com tracking completo | Criar funil de conversão otimizado com landing pages específicas por produto/categoria | Implementar remarketing inteligente para carrinho abandonado e visitantes sem compra | Configurar Google Analytics 4 + Tag Manager com eventos de conversão e atribuição multicanal',
  10,
  1,
  ARRAY['marketing_digital', 'performance', 'ads', 'trafego']
),

(
  'E-commerce com alta taxa de carrinho abandonado',
  ARRAY['ecommerce', 'varejo_online', 'loja_online'],
  ARRAY['marketing', 'vendas', 'ti'],
  'carrinho abandonado, abandono de carrinho, cliente não finaliza compra, desistência na compra, alta taxa de abandono, muitos carrinhos abertos, checkout com problemas',
  'Implementar fluxo automatizado de recuperação de carrinho (email + SMS + WhatsApp) com gatilhos inteligentes em 1h, 24h e 48h | Otimizar experiência de checkout reduzindo etapas de 5 para 3 e adicionando métodos de pagamento populares (Pix, carteiras digitais) | Instalar ferramenta de session replay (Hotjar/Microsoft Clarity) para identificar fricções no checkout e pontos de abandono | Criar campanha de remarketing específica para carrinhos abandonados com desconto progressivo baseado em tempo',
  9,
  1,
  ARRAY['conversao', 'checkout', 'ux', 'automacao']
),

(
  'E-commerce sem controle de estoque',
  ARRAY['ecommerce', 'varejo_online', 'loja_online'],
  ARRAY['operacoes', 'logistica', 'ti'],
  'sem controle de estoque, ruptura de estoque, produto esgotado, falta de produto, descontrole de inventário, não sabe o que tem no estoque, vendeu produto sem estoque, problemas com estoque',
  'Implementar sistema de gestão de estoque integrado com e-commerce (API real-time) com alertas automáticos de ruptura e ressuprimento | Estabelecer processo de inventário cíclico semanal com auditoria de 20% dos SKUs por rotação ABC | Criar dashboard de indicadores de estoque (giro, cobertura, ruptura, acuracidade) com metas e alertas | Definir política de estoque mínimo e ponto de pedido por categoria usando histórico de 90 dias de vendas',
  8,
  1,
  ARRAY['estoque', 'operacoes', 'logistica']
),

-- SAAS / TECNOLOGIA
(
  'SaaS com alto churn de clientes',
  ARRAY['saas', 'tecnologia', 'software'],
  ARRAY['vendas', 'marketing', 'ti'],
  'churn alto, cancelamento de clientes, cliente cancela, perda de assinantes, rotatividade de clientes, retenção baixa, MRR caindo, cliente não renova',
  'Implementar customer health score automatizado baseado em uso do produto (login, features utilizadas, tickets abertos) com alertas para CSM em clientes em risco | Criar programa de onboarding estruturado com 5 marcos de adoção nos primeiros 30 dias e automação de follow-up | Estabelecer processo de exit interview sistemático com análise de padrões de cancelamento e feedback loop para produto | Desenvolver estratégia de upsell/cross-sell proativa para aumentar stickiness com playbook de expansão de conta',
  10,
  1,
  ARRAY['retenção', 'customer_success', 'saas_metrics']
),

(
  'SaaS com CAC maior que LTV',
  ARRAY['saas', 'tecnologia', 'software'],
  ARRAY['vendas', 'marketing', 'financeiro'],
  'CAC alto, custo de aquisição alto, LTV baixo, CAC maior que LTV, unidade economics ruim, payback muito longo, não é lucrativo adquirir cliente',
  'Reestruturar funil de vendas implementando leads qualification framework (BANT/MEDDIC) para aumentar taxa de conversão SQL→Oportunidade de 15% para 35% | Implementar estratégia de marketing de conteúdo e SEO para reduzir CAC em 40% nos próximos 6 meses com blog técnico e materials educativos | Criar programa de customer advocacy com incentivo financeiro para indicações (referral fee) visando CAC zero em 20% das aquisições | Desenvolver estratégia de upsell e cross-sell para aumentar LTV em 60% através de features premium e add-ons',
  9,
  1,
  ARRAY['unit_economics', 'saas_metrics', 'growth']
),

-- SERVIÇOS / CONSULTORIA
(
  'Consultoria com baixa taxa de utilização da equipe',
  ARRAY['servicos', 'consultoria', 'agencia'],
  ARRAY['operacoes', 'financeiro', 'rh'],
  'ociosidade, equipe ociosa, baixa utilização, consultores sem projeto, bench alto, baixa alocação, muito tempo disponível, pouca demanda',
  'Implementar sistema de resource planning com visibilidade de 90 dias de pipeline vs capacidade e alocação dinâmica por skill | Criar estratégia de produtos/ofertas padronizadas (retainer mensal) para reduzir dependência de projetos spot e estabilizar receita | Estabelecer processo comercial proativo com cadência semanal de prospecção ativa (cold outreach + network) gerando 10 oportunidades/mês por sênior | Desenvolver programa de bench produtivo com treinamento interno, R&D de metodologias e criação de IP (templates, playbooks) para aumentar valor',
  8,
  1,
  ARRAY['utilização', 'alocação', 'servicos']
),

(
  'Serviços sem precificação estruturada',
  ARRAY['servicos', 'consultoria', 'agencia'],
  ARRAY['financeiro', 'vendas'],
  'não sabe precificar, preço na hora, sem tabela de preços, precificação ad hoc, margem inconsistente, hora não lucrativa, preço baixo',
  'Desenvolver matriz de precificação estruturada por tipo de serviço, seniority e complexidade com 3 tiers (básico/premium/enterprise) | Calcular custo real de hora trabalhada (all-in cost) incluindo salários, benefícios, overhead, impostos e definir markup de 2.5-3.5x | Criar calculadora de proposta automatizada no Excel/Google Sheets com breakdown de horas, investimento e ROI esperado para cliente | Estabelecer política comercial com alçadas de desconto (0-10% gerente, 10-20% diretor, >20% board) e tracking de margem real por projeto',
  9,
  1,
  ARRAY['precificação', 'margem', 'financeiro']
),

-- VAREJO FÍSICO
(
  'Loja física com baixo ticket médio',
  ARRAY['varejo_fisico', 'loja'],
  ARRAY['vendas', 'marketing'],
  'ticket médio baixo, cliente compra pouco, venda baixa por cliente, falta venda adicional, sem cross-sell, sem up-sell, não oferece complemento',
  'Implementar programa de treinamento de vendas consultivas com técnicas de upsell e cross-sell, incluindo simulações práticas semanais e gamificação | Criar mix de produtos estratégico posicionando itens complementares de alta margem próximos aos best-sellers com sinalização visual | Estabelecer meta diária de ticket médio por vendedor com bônus progressivo (10% acima = 2% comissão extra, 20% acima = 5% extra) | Desenvolver programa de fidelidade escalonado incentivando compras recorrentes e maiores cestas (R$ 100 = 5%, R$ 200 = 10%, R$ 500 = 15% desconto)',
  7,
  1,
  ARRAY['ticket_medio', 'vendas', 'varejo']
),

(
  'Varejo com alto índice de perda e quebra',
  ARRAY['varejo_fisico', 'varejo_online', 'loja'],
  ARRAY['operacoes', 'financeiro', 'qualidade'],
  'perda alta, quebra, furto, roubo interno, validade vencida, produto estragado, shrinkage, loss prevention',
  'Implementar sistema de controle de perdas com câmeras inteligentes em pontos críticos e auditoria diária de inventário em produtos classe A | Estabelecer processo de FIFO rigoroso com etiquetagem de data de entrada e inspeção de validade 2x/semana em perecíveis | Criar programa anti-furto com treinamento de equipe em identificação de comportamentos suspeitos e protocolo de abordagem | Desenvolver dashboard de perdas por categoria/vendedor/turno com investigação sistemática de outliers e meta de redução de 2% para 0.5%',
  8,
  1,
  ARRAY['perdas', 'shrinkage', 'controle']
),

-- INDÚSTRIA / PRODUÇÃO
(
  'Indústria com alto tempo de setup',
  ARRAY['industria', 'producao', 'manufatura'],
  ARRAY['operacoes', 'qualidade'],
  'setup longo, troca de ferramenta demorada, preparação demorada, tempo de máquina parada, setup ineficiente, SMED, troca de produto lenta',
  'Aplicar metodologia SMED (Single Minute Exchange of Die) com análise de vídeo dos setups atuais e separação de atividades internas vs externas | Criar kits de setup pré-preparados com ferramentas e dispositivos organizados por célula e checklist visual de preparação | Implementar treinamento prático de equipe em setup rápido com cronometragem e meta de redução de 50% em 60 dias | Padronizar sequência de produção minimizando trocas de família de produtos e criando lotes econômicos otimizados',
  7,
  1,
  ARRAY['lean', 'smed', 'producao']
),

(
  'Produção sem controle de qualidade estruturado',
  ARRAY['industria', 'producao', 'manufatura'],
  ARRAY['qualidade', 'operacoes'],
  'sem controle de qualidade, retrabalho alto, defeito, refugo, produto com problema, reclamação de cliente, qualidade inconsistente, falta inspeção',
  'Implementar sistema de controle estatístico de processo (CEP) com cartas de controle e inspeção por amostragem em pontos críticos do fluxo | Criar matriz de controle de qualidade definindo características críticas, método de inspeção, frequência e critérios de aceitação/rejeição | Estabelecer sistemática de análise de causa raiz (Ishikawa + 5 Porquês) para cada não-conformidade com CAPA obrigatório e verificação de eficácia | Desenvolver programa de qualidade na fonte com autonomação (Jidoka) e treinamento de operadores em autoinspeção e parada de linha',
  9,
  1,
  ARRAY['qualidade', 'cep', 'six_sigma']
),

-- MULTI-SEGMENTO: PROCESSOS E GESTÃO
(
  'Empresa sem indicadores de desempenho',
  ARRAY['servicos', 'industria', 'varejo_fisico', 'ecommerce', 'tecnologia', 'consultoria'],
  ARRAY['operacoes', 'financeiro', 'qualidade'],
  'sem KPI, sem indicador, sem métrica, não mede nada, não tem dashboard, não sabe o resultado, sem acompanhamento, sem meta',
  'Definir sistema de indicadores estratégicos (BSC) com 3-5 KPIs por perspectiva (financeira, clientes, processos, aprendizado) alinhados à estratégia | Implementar rotina de medição automatizada com coleta de dados semanal e dashboard visual (Power BI/Looker Studio) com semáforo verde/amarelo/vermelho | Estabelecer ciclo de gestão com reuniões mensais de análise crítica, identificação de desvios, plano de ação e responsáveis por meta | Criar cultura data-driven com treinamento de gestores em interpretação de dados e tomada de decisão baseada em evidências',
  10,
  1,
  ARRAY['kpi', 'indicadores', 'bsc', 'gestao']
),

(
  'Processos não documentados e inconsistentes',
  ARRAY['servicos', 'industria', 'varejo_fisico', 'ecommerce', 'tecnologia', 'consultoria'],
  ARRAY['operacoes', 'qualidade', 'rh'],
  'processos ad hoc, cada um faz de um jeito, sem padronização, sem procedimento, sem documentação, depende da pessoa, conhecimento na cabeça das pessoas, sem processo formal',
  'Mapear processos críticos de ponta a ponta usando BPMN/fluxograma identificando entradas, saídas, responsáveis e pontos de decisão | Documentar procedimentos operacionais padrão (POPs) com passo a passo detalhado, imagens, tempos padrão e critérios de qualidade | Implementar programa de capacitação estruturado com treinamento on-the-job, avaliação de proficiência e certificação interna | Criar sistema de gestão de processos com controle de versão, auditoria trimestral de aderência e melhoria contínua via kaizen',
  9,
  1,
  ARRAY['bpm', 'padronizacao', 'documentacao']
),

(
  'Empresa com dependência de pessoas-chave',
  ARRAY['servicos', 'tecnologia', 'consultoria', 'industria'],
  ARRAY['rh', 'operacoes', 'gestao'],
  'dependência de pessoa, conhecimento concentrado, sócio faz tudo, pessoa-chave, risco de perder funcionário crítico, bus factor, single point of failure humano',
  'Criar matriz de competências críticas mapeando conhecimentos essenciais e nível de profundidade por pessoa com identificação de gaps | Implementar programa de job rotation estruturado com shadowing e cross-training entre membros da equipe em processos críticos | Estabelecer processo de documentação de conhecimento tácito através de wikis internas, vídeos tutoriais e sessões de knowledge sharing mensais | Desenvolver plano de sucessão formal com identificação de backups para cada posição crítica e pipeline de desenvolvimento de talentos internos',
  8,
  1,
  ARRAY['gestao_pessoas', 'conhecimento', 'sucessao']
),

-- FINANCEIRO / GESTÃO
(
  'Empresa sem controle de fluxo de caixa',
  ARRAY['servicos', 'industria', 'varejo_fisico', 'ecommerce', 'tecnologia', 'consultoria'],
  ARRAY['financeiro'],
  'sem fluxo de caixa, não sabe o que tem de dinheiro, descontrole financeiro, aperto de caixa, não sabe quando vai receber, não sabe quando vai pagar, surpresa financeira',
  'Implementar fluxo de caixa projetado com horizonte rolling de 90 dias incluindo contas a pagar, contas a receber e investimentos planejados | Estabelecer rotina financeira diária com conciliação bancária, atualização de recebimentos/pagamentos e análise de saldo disponível vs projetado | Criar política de capital de giro definindo reserva mínima de segurança (45 dias de despesas fixas) e gatilhos de ação para baixa liquidez | Desenvolver dashboard financeiro integrado com indicadores de liquidez (índice de liquidez corrente, ciclo financeiro, dias de caixa) e cenários what-if',
  10,
  1,
  ARRAY['fluxo_caixa', 'financeiro', 'liquidez']
),

(
  'Empresa com margem líquida abaixo de 5%',
  ARRAY['servicos', 'industria', 'varejo_fisico', 'ecommerce', 'varejo_online'],
  ARRAY['financeiro', 'operacoes'],
  'margem baixa, lucro baixo, margem líquida ruim, pouco lucro, quase sem lucro, resultado financeiro fraco, rentabilidade baixa, EBITDA negativo',
  'Realizar análise completa de estrutura de custos com decomposição por categoria (fixo vs variável, direto vs indireto) e benchmark setorial | Implementar projeto de redução de custos estruturada com meta de 15-20% em 120 dias focando em desperdícios, renegociação de contratos e automação | Revisar estratégia de precificação com análise de elasticidade, valor percebido e reajuste progressivo de 8-12% com comunicação de valor agregado | Criar modelo de custeio por produto/serviço (ABC) para identificar ofertas não lucrativas e decisão de descontinuar ou reprecificar',
  10,
  1,
  ARRAY['margem', 'rentabilidade', 'custos']
),

-- VENDAS E COMERCIAL
(
  'Empresa com ciclo de vendas muito longo',
  ARRAY['saas', 'tecnologia', 'servicos', 'consultoria', 'industria'],
  ARRAY['vendas', 'marketing'],
  'venda demora, ciclo longo de vendas, demora para fechar, negociação arrasta, processo de compra longo, lead não decide',
  'Implementar metodologia de vendas estruturada (SPIN/Challenger) com qualification rigorosa de leads para focar esforços em oportunidades de alta propensão | Criar materiais de vendas consultivos (ROI calculator, case studies, demo personalizado) que aceleram tomada de decisão demonstrando valor tangível | Estabelecer cadência comercial disciplinada com follow-up automatizado, múltiplos pontos de contato e gatilhos de urgência (escassez, sazonalidade) | Desenvolver programa de inside sales com SDRs qualificando leads antes de passar para AE e reduzindo tempo de discovery em 40%',
  8,
  1,
  ARRAY['vendas', 'ciclo_vendas', 'conversao']
),

(
  'Equipe comercial sem processo estruturado',
  ARRAY['varejo_fisico', 'servicos', 'industria', 'ecommerce', 'tecnologia'],
  ARRAY['vendas'],
  'vendedor faz do seu jeito, sem pipeline, sem CRM, sem follow-up, sem processo comercial, cada vendedor vende diferente, sem metodologia de vendas',
  'Implementar CRM completo (HubSpot/Pipedrive/RD Station) com stages obrigatórios, campos customizados e automações de follow-up | Criar playbook de vendas detalhado com scripts de abordagem, tratamento de objeções, técnicas de fechamento e cases de sucesso | Estabelecer rotina comercial semanal com pipeline review, forecast de vendas, identificação de deals travados e coaching 1:1 | Desenvolver sistema de metas individuais e coletivas com remuneração variável atrelada (50% fixo + 50% variável) e gamificação',
  9,
  1,
  ARRAY['vendas', 'crm', 'processo_comercial']
),

-- MARKETING E BRANDING
(
  'Empresa sem posicionamento claro de marca',
  ARRAY['servicos', 'varejo_fisico', 'ecommerce', 'varejo_online', 'tecnologia'],
  ARRAY['marketing', 'vendas'],
  'marca fraca, sem diferenciação, sem posicionamento, commodity, cliente não sabe por que comprar, igual aos concorrentes, sem proposta de valor clara',
  'Desenvolver posicionamento de marca estruturado definindo público-alvo específico, proposta de valor única, personalidade e tom de voz | Criar identidade visual consistente com manual de marca, aplicação em todos pontos de contato e auditoria de aderência trimestral | Implementar estratégia de conteúdo com storytelling da marca, cases de transformação de clientes e thought leadership no setor | Estabelecer monitoramento de brand awareness e sentiment através de pesquisas NPS, social listening e share of voice vs concorrentes',
  7,
  1,
  ARRAY['branding', 'posicionamento', 'marketing']
),

(
  'Empresa sem estratégia de conteúdo',
  ARRAY['saas', 'tecnologia', 'servicos', 'consultoria', 'ecommerce'],
  ARRAY['marketing', 'vendas'],
  'sem conteúdo, sem blog, sem rede social, sem presença digital, invisível na internet, não produz conteúdo, sem marketing de conteúdo, sem SEO',
  'Criar estratégia de content marketing com pilares de conteúdo alinhados à jornada do comprador (awareness, consideration, decision) | Implementar calendário editorial com produção sistemática de 2 blog posts/semana, 1 material rico/mês e presença ativa em 2 canais sociais | Desenvolver programa de SEO técnico e on-page com keyword research, otimização de páginas principais e link building estruturado | Estabelecer processo de distribuição multicanal (blog, LinkedIn, YouTube, email) com reutilização inteligente de conteúdo (atomização)',
  8,
  1,
  ARRAY['content_marketing', 'seo', 'inbound']
),

-- TECNOLOGIA E SISTEMAS
(
  'Empresa com sistemas não integrados',
  ARRAY['varejo_fisico', 'ecommerce', 'varejo_online', 'industria', 'servicos'],
  ARRAY['ti', 'operacoes', 'financeiro'],
  'sistemas separados, sem integração, dupla digitação, retrabalho de dados, sistema não conversa, planilhas manuais, dados inconsistentes entre sistemas',
  'Mapear ecossistema de sistemas atuais identificando fluxos de dados críticos, volumetria e pontos de atrito operacional | Implementar camada de integração (iPaaS como Zapier/Make/n8n ou APIs customizadas) conectando sistemas prioritários (ERP-CRM-E-commerce) | Estabelecer governança de dados com políedade de sistema master por entidade (cliente, produto, pedido) e sincronização unidirecional | Criar roadmap de integração faseado priorizando quick wins (80/20) e avaliando necessidade de substituição de sistemas legados',
  8,
  1,
  ARRAY['integracao', 'sistemas', 'ti']
);
