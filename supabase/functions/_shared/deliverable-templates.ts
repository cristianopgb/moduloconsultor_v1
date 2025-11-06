/**
 * TEMPLATES HTML PROFISSIONAIS PARA ENTREGÁVEIS
 *
 * Templates específicos para cada tipo de entregável gerado automaticamente
 * Design limpo e profissional com branding Proceda
 */

const BRAND_COLORS = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#3b82f6',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  background: '#ffffff',
  backgroundLight: '#f9fafb'
};

const BASE_STYLES = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${BRAND_COLORS.text};
    line-height: 1.6;
    background: ${BRAND_COLORS.backgroundLight};
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  .header {
    background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }
  .header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .header p {
    font-size: 1rem;
    opacity: 0.9;
  }
  .section {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: ${BRAND_COLORS.primary};
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid ${BRAND_COLORS.border};
  }
  .section h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }
  .card {
    background: ${BRAND_COLORS.backgroundLight};
    border-radius: 8px;
    padding: 1.5rem;
    border-left: 4px solid ${BRAND_COLORS.accent};
  }
  .card h4 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .card p {
    font-size: 0.875rem;
    color: ${BRAND_COLORS.textLight};
  }
  .matrix {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }
  .matrix-cell {
    padding: 1.5rem;
    border-radius: 8px;
    border: 2px solid ${BRAND_COLORS.border};
  }
  .matrix-cell.high { background: #fee2e2; border-color: #ef4444; }
  .matrix-cell.medium { background: #fef3c7; border-color: #f59e0b; }
  .matrix-cell.low { background: #dcfce7; border-color: #10b981; }
  .table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }
  .table th {
    background: ${BRAND_COLORS.primary};
    color: white;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
  }
  .table td {
    padding: 0.75rem;
    border-bottom: 1px solid ${BRAND_COLORS.border};
  }
  .table tr:hover {
    background: ${BRAND_COLORS.backgroundLight};
  }
  .footer {
    text-align: center;
    padding: 2rem;
    color: ${BRAND_COLORS.textLight};
    font-size: 0.875rem;
  }
  @media print {
    body { background: white; }
    .section { box-shadow: none; page-break-inside: avoid; }
  }
</style>
`;

export function generateAnamneseHTML(contexto: any): string {
  const anamnese = contexto.anamnese || contexto;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Anamnese - ${anamnese.empresa || 'Empresa'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Relatório de Anamnese Empresarial</h1>
      <p>Perfil completo do profissional e da organização</p>
    </div>

    <div class="section">
      <h2>Perfil do Profissional</h2>
      <div class="grid">
        <div class="card">
          <h4>Nome</h4>
          <p>${anamnese.nome || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Cargo</h4>
          <p>${anamnese.cargo || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Idade</h4>
          <p>${anamnese.idade || anamnese.faixa_etaria || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Formação</h4>
          <p>${anamnese.formacao || 'N/A'}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Perfil da Empresa</h2>
      <div class="grid">
        <div class="card">
          <h4>Nome da Empresa</h4>
          <p>${anamnese.empresa || anamnese.empresa_nome || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Segmento</h4>
          <p>${anamnese.segmento || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Faturamento</h4>
          <p>${anamnese.faturamento || 'N/A'}</p>
        </div>
        <div class="card">
          <h4>Colaboradores</h4>
          <p>${anamnese.funcionarios || anamnese.num_funcionarios || 'N/A'}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Resumo Executivo</h2>
      <p style="line-height: 1.8; margin-bottom: 1rem;">
        <strong>${anamnese.nome || 'O profissional'}</strong>, ${anamnese.cargo || 'responsável'} da <strong>${anamnese.empresa || 'empresa'}</strong>,
        atua no segmento de <strong>${anamnese.segmento || 'seu mercado'}</strong>.
        ${anamnese.funcionarios ? `A empresa conta com ${anamnese.funcionarios} colaboradores` : 'A equipe'}
        ${anamnese.faturamento ? ` e faturamento de R$ ${anamnese.faturamento}` : ''}.
      </p>
      <p style="line-height: 1.8; margin-bottom: 1rem;">
        <strong>Desafio Principal:</strong> ${anamnese.dor_principal || anamnese.desafios_principais || 'Não especificado'}
      </p>
      <p style="line-height: 1.8;">
        <strong>Objetivo de Sucesso:</strong> ${anamnese.expectativa_sucesso || anamnese.expectativa || anamnese.expectativas || 'Não especificado'}
      </p>
    </div>

    <div class="section">
      <h2>Contexto e Motivação</h2>
      <h3>Principal Dor/Desafio</h3>
      <p>${anamnese.dor_principal || anamnese.desafios_principais || 'Não especificado'}</p>

      <h3>Expectativa de Sucesso</h3>
      <p>${anamnese.expectativa_sucesso || anamnese.expectativa || anamnese.expectativas || 'Não especificado'}</p>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateCanvasHTML(contexto: any): string {
  // Suporta múltiplos formatos de estrutura de dados
  const mapeamento = contexto.mapeamento || {};
  const canvas = mapeamento.canvas || contexto.canvas || {};

  // Extrair dados de canvas_ prefixado (formato atual do LLM)
  const canvasData = {
    proposta_valor: canvas.proposta_valor || mapeamento.canvas_proposta_valor || canvas.value_proposition || 'Não especificado',
    segmentos_cliente: canvas.segmentos_cliente || mapeamento.canvas_segmentos_cliente || canvas.customer_segments || 'N/A',
    canais: canvas.canais || mapeamento.canvas_canais || canvas.channels || 'N/A',
    relacionamento: canvas.relacionamento || mapeamento.canvas_relacionamento || canvas.customer_relationships || 'N/A',
    receitas: canvas.receitas || mapeamento.canvas_receitas || canvas.revenue_streams || 'N/A',
    recursos: canvas.recursos || mapeamento.canvas_recursos || canvas.key_resources || 'N/A',
    atividades: canvas.atividades || mapeamento.canvas_atividades || canvas.key_activities || 'N/A',
    parcerias: canvas.parcerias || mapeamento.canvas_parcerias || canvas.key_partnerships || 'N/A',
    custos: canvas.custos || mapeamento.canvas_custos || canvas.cost_structure || 'N/A'
  };

  const empresa = contexto.empresa || contexto.anamnese?.empresa || mapeamento.empresa || 'Empresa';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Model Canvas - ${empresa}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Business Model Canvas</h1>
      <p>Modelo de negócio da ${empresa}</p>
    </div>

    <div class="section">
      <h2>Resumo Executivo</h2>
      <p style="line-height: 1.8; margin-bottom: 1rem;">
        A <strong>${empresa}</strong> opera no modelo de negócio baseado em <strong>${canvasData.proposta_valor}</strong>,
        atendendo <strong>${canvasData.segmentos_cliente}</strong>.
        A empresa mantém relacionamento com clientes através de <strong>${canvasData.relacionamento}</strong>
        e gera receita por meio de <strong>${canvasData.receitas}</strong>.
      </p>
      <p style="line-height: 1.8;">
        As operações dependem de recursos como <strong>${canvasData.recursos}</strong>,
        executando atividades de <strong>${canvasData.atividades}</strong>,
        com suporte de parcerias estratégicas com <strong>${canvasData.parcerias}</strong>.
      </p>
    </div>

    <div class="section">
      <h2>Proposta de Valor</h2>
      <p>${canvasData.proposta_valor}</p>
    </div>

    <div class="grid">
      <div class="card">
        <h4>Segmentos de Cliente</h4>
        <p>${canvasData.segmentos_cliente}</p>
      </div>
      <div class="card">
        <h4>Canais</h4>
        <p>${canvasData.canais}</p>
      </div>
      <div class="card">
        <h4>Relacionamento</h4>
        <p>${canvasData.relacionamento}</p>
      </div>
      <div class="card">
        <h4>Fontes de Receita</h4>
        <p>${canvasData.receitas}</p>
      </div>
      <div class="card">
        <h4>Recursos Principais</h4>
        <p>${canvasData.recursos}</p>
      </div>
      <div class="card">
        <h4>Atividades-Chave</h4>
        <p>${canvasData.atividades}</p>
      </div>
      <div class="card">
        <h4>Parcerias</h4>
        <p>${canvasData.parcerias}</p>
      </div>
      <div class="card">
        <h4>Estrutura de Custos</h4>
        <p>${canvasData.custos}</p>
      </div>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateMatrizPriorizacaoHTML(contexto: any): string {
  const priorizacao = contexto.priorizacao || {};
  // Tentar múltiplas fontes para os processos
  let processos = contexto.processos ||
                  priorizacao.processos ||
                  priorizacao.processos_priorizados ||
                  contexto.matriz_gut ||
                  contexto.processos_identificados ||
                  [];

  // INFERIR GUT quando faltar (heurística robusta baseada em contexto)
  processos = processos.map((p: any, index: number) => {
    let nome = '';
    if (typeof p === 'string') {
      nome = p;
    } else {
      nome = p.nome || p.processo || `Processo ${index + 1}`;
    }

    // Heurística de inferência baseada em palavras-chave
    const nomeLower = nome.toLowerCase();

    // Gravidade: baseada em impacto potencial
    let g = 3; // padrão médio
    if (nomeLower.includes('financeiro') || nomeLower.includes('vendas') || nomeLower.includes('receita') || nomeLower.includes('lucro')) {
      g = 5; // crítico
    } else if (nomeLower.includes('operacion') || nomeLower.includes('produção') || nomeLower.includes('entrega')) {
      g = 4; // alto
    } else if (nomeLower.includes('apoio') || nomeLower.includes('suporte') || nomeLower.includes('rh')) {
      g = 3; // médio
    } else if (index < 3) {
      g = 5 - Math.floor(index / 2); // Primeiros processos são mais graves
    }

    // Urgência: baseada em contexto e posição
    let u = 3; // padrão médio
    if (nomeLower.includes('urgente') || nomeLower.includes('crítico') || nomeLower.includes('crise')) {
      u = 5;
    } else if (index < 5) {
      u = 5 - Math.floor(index / 2.5); // Urgência decrescente
    } else {
      u = 2 + Math.floor(Math.random() * 2); // 2 ou 3 para processos menos urgentes
    }

    // Tendência: baseada em tipo de problema
    let t = 4; // padrão (tende a piorar)
    if (nomeLower.includes('gestão') || nomeLower.includes('controle') || nomeLower.includes('planejamento')) {
      t = 5; // tende a piorar muito se não resolvido
    } else if (nomeLower.includes('apoio') || nomeLower.includes('suporte')) {
      t = 3; // estável
    }

    // Se já tem valores, usar (validar range 1-5)
    if (typeof p === 'object') {
      g = p.gravidade ? Math.max(1, Math.min(5, p.gravidade)) : g;
      u = p.urgencia ? Math.max(1, Math.min(5, p.urgencia)) : u;
      t = p.tendencia ? Math.max(1, Math.min(5, p.tendencia)) : t;
    }

    const score = g * u * t;
    const prioridade = score >= 75 ? 'Alta' : score >= 40 ? 'Média' : 'Baixa';

    return {
      nome,
      processo: nome,
      gravidade: g,
      urgencia: u,
      tendencia: t,
      score,
      prioridade,
      ...(typeof p === 'object' ? { justificativa: p.justificativa, descricao: p.descricao } : {})
    };
  });

  // Ordenar por score (maior primeiro)
  processos.sort((a: any, b: any) => b.score - a.score);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matriz de Priorização - ${contexto.empresa || 'Empresa'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Matriz de Priorização (GUT)</h1>
      <p>Processos críticos identificados e priorizados</p>
    </div>

    <div class="section">
      <h2>Processos Priorizados</h2>
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Processo</th>
            <th>Gravidade</th>
            <th>Urgência</th>
            <th>Tendência</th>
            <th>Score</th>
            <th>Prioridade</th>
          </tr>
        </thead>
        <tbody>
          ${processos.map((p: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${p.nome || p.processo || 'N/A'}</strong></td>
              <td>${p.gravidade || 'N/A'}</td>
              <td>${p.urgencia || 'N/A'}</td>
              <td>${p.tendencia || 'N/A'}</td>
              <td><strong>${p.score || 'N/A'}</strong></td>
              <td>${p.prioridade || (i < 3 ? 'Alta' : i < 6 ? 'Média' : 'Baixa')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Escopo do Projeto</h2>
      <h3>Processos no Escopo</h3>
      <ul>
        ${processos.slice(0, 5).map((p: any) => `
          <li><strong>${p.nome || p.processo}</strong>: ${p.justificativa || 'Processo crítico identificado'}</li>
        `).join('')}
      </ul>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generatePlanoAcaoHTML(contexto: any): string {
  const plano = contexto.plano_acao || contexto.execucao || {};
  // Aceitar acoes direto no contexto ou dentro de plano
  let acoes = contexto.acoes || plano.acoes || [];

  // GERAR AÇÕES VIÁVEIS E DETALHADAS se não tiver (FALLBACK ROBUSTO)
  if (acoes.length === 0) {
    const escopo = contexto.escopo || {};
    const processosEscopo = contexto.processos_escopo || escopo.processos_escopo || [];
    const diagnostico = contexto.diagnostico || {};
    const recomendacoes = diagnostico.recomendacoes || contexto.recomendacoes || [];
    const priorizacao = contexto.priorizacao || {};
    const processosPriorizados = priorizacao.processos || contexto.processos || [];

    // Estratégia 1: Criar ações detalhadas baseadas no escopo
    if (processosEscopo.length > 0) {
      acoes = processosEscopo.slice(0, 5).map((p: any, index: number) => {
        const nomeProcesso = typeof p === 'string' ? p : p.nome;
        const tipoAcao = index % 3;

        if (tipoAcao === 0) {
          return {
            what: `Mapear e documentar processo ${nomeProcesso} em detalhe (AS-IS)`,
            why: `Criar baseline visual e identificar gargalos, redundâncias e oportunidades de automação no processo atual`,
            who: `Gestor responsável pelo ${nomeProcesso} + Analista de Processos`,
            when: `Prazo: ${15 + index * 5} dias úteis`,
            where: `Área de ${nomeProcesso}`,
            how: `Realizar entrevistas com executores, observar fluxo real, desenhar BPMN AS-IS, validar com equipe, documentar indicadores atuais`,
            how_much: `Investimento: 40-60h de trabalho interno (custo de oportunidade estimado em R$ 3.000-5.000)`
          };
        } else if (tipoAcao === 1) {
          return {
            what: `Redesenhar processo ${nomeProcesso} otimizado (TO-BE)`,
            why: `Eliminar desperdícios, padronizar atividades e melhorar indicadores de performance identificados na análise`,
            who: `Gestor responsável pelo ${nomeProcesso} + Equipe operacional`,
            when: `Prazo: ${20 + index * 5} dias úteis (após mapeamento AS-IS)`,
            where: `Área de ${nomeProcesso}`,
            how: `Analisar AS-IS, aplicar técnicas Lean, desenhar TO-BE, simular cenários, validar viabilidade, documentar novo fluxo`,
            how_much: `Investimento: 30-50h de trabalho interno + eventual consultoria externa (R$ 4.000-8.000)`
          };
        } else {
          return {
            what: `Implementar melhorias no processo ${nomeProcesso} e treinar equipe`,
            why: `Garantir que mudanças sejam adotadas, equipe capacitada e resultados sustentáveis`,
            who: `Gestor da área + RH (treinamento) + TI (sistemas)`,
            when: `Prazo: ${25 + index * 5} dias úteis (após aprovação TO-BE)`,
            where: `Área de ${nomeProcesso}`,
            how: `Realizar treinamento hands-on, ajustar sistemas/ferramentas, acompanhar execução por 2 semanas, coletar feedback, ajustar conforme necessário`,
            how_much: `Investimento: 50-80h internas + possível aquisição de ferramentas (R$ 5.000-15.000)`
          };
        }
      });
    }
    // Estratégia 2: Baseado em recomendações
    else if (recomendacoes.length > 0) {
      acoes = recomendacoes.slice(0, 5).map((r: any, index: number) => ({
        what: typeof r === 'string' ? r : r.recomendacao || r.descricao || `Implementar melhoria ${index + 1}`,
        why: typeof r === 'object' && r.impacto ? r.impacto : `Ação corretiva identificada no diagnóstico para melhorar performance operacional`,
        who: `Gestor responsável pela área + Equipe multidisciplinar`,
        when: `Prazo: ${15 + index * 10} dias úteis`,
        where: `Área impactada pela recomendação`,
        how: `Planejar implementação, alocar recursos, executar mudanças, monitorar resultados, ajustar conforme feedback`,
        how_much: `Investimento a ser detalhado: estimativa inicial R$ ${3000 + index * 2000} - R$ ${5000 + index * 3000}`
      }));
    }
    // Estratégia 3: Baseado em processos priorizados
    else if (processosPriorizados.length > 0) {
      acoes = processosPriorizados.slice(0, 5).map((p: any, index: number) => {
        const nomeProcesso = typeof p === 'string' ? p : (p.nome || p.processo);
        return {
          what: `Avaliar e otimizar processo ${nomeProcesso}`,
          why: `Processo identificado como prioritário na matriz GUT com alto impacto nos resultados`,
          who: `Líder do processo + Consultor interno`,
          when: `Prazo: ${20 + index * 7} dias úteis`,
          where: `Departamento responsável pelo ${nomeProcesso}`,
          how: `Diagnóstico detalhado, identificação de quick wins, implementação de melhorias incrementais, medição de resultados`,
          how_much: `Investimento: R$ ${5000 + index * 2000} (horas internas + ferramentas)`
        };
      });
    }
    // Estratégia 4: Ações genéricas porém acionáveis (último recurso)
    else {
      acoes = [
        {
          what: `Mapear e documentar processos críticos da organização`,
          why: `Criar visibilidade sobre como o trabalho realmente acontece e identificar oportunidades de melhoria`,
          who: `Gerente de Operações + Time de Processos`,
          when: `Prazo: 30 dias úteis`,
          where: `Áreas operacionais principais`,
          how: `Selecionar 3-5 processos críticos, entrevistar executores, desenhar fluxogramas, documentar em ferramenta de BPM, validar com stakeholders`,
          how_much: `Investimento: 100h internas + ferramenta BPM (R$ 8.000-12.000)`
        },
        {
          what: `Implementar sistema de indicadores (KPIs) por processo`,
          why: `Medir para gerenciar: sem indicadores não há como avaliar performance e tomar decisões baseadas em dados`,
          who: `Controller + Gestores de Área`,
          when: `Prazo: 45 dias úteis`,
          where: `Todas as áreas operacionais`,
          how: `Definir KPIs críticos por processo, criar dashboards em BI, treinar equipe na leitura, estabelecer rotina de análise semanal`,
          how_much: `Investimento: BI tool (R$ 500/mês) + 80h setup interno (R$ 6.000-10.000)`
        },
        {
          what: `Capacitar líderes em gestão por processos e melhoria contínua`,
          why: `Criar cultura de excelência operacional e autonomia para resolução de problemas na base`,
          who: `RH + Consultoria especializada`,
          when: `Prazo: 60 dias úteis (programa contínuo)`,
          where: `Sala de treinamento / Online`,
          how: `Programa de 40h (Lean, Six Sigma, BPM), workshops práticos aplicados aos processos reais, certificação interna`,
          how_much: `Investimento: R$ 15.000-25.000 (consultoria + material)`
        }
      ];
    }
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plano de Ação 5W2H - ${contexto.empresa || 'Empresa'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Plano de Ação Executivo (5W2H)</h1>
      <p>Ações corretivas estruturadas para execução</p>
    </div>

    <div class="section">
      <h2>Ações Prioritárias</h2>
      <table class="table">
        <thead>
          <tr>
            <th>O Quê</th>
            <th>Por Quê</th>
            <th>Quem</th>
            <th>Quando</th>
            <th>Onde</th>
            <th>Como</th>
            <th>Quanto</th>
          </tr>
        </thead>
        <tbody>
          ${acoes.map((acao: any) => `
            <tr>
              <td><strong>${acao.what || acao.o_que || acao.nome || 'N/A'}</strong></td>
              <td>${acao.why || acao.por_que || acao.justificativa || 'N/A'}</td>
              <td>${acao.who || acao.quem || acao.responsavel || 'A definir'}</td>
              <td>${acao.when || acao.quando || acao.prazo || 'A definir'}</td>
              <td>${acao.where || acao.onde || acao.area || 'N/A'}</td>
              <td>${acao.how || acao.como || 'A definir método'}</td>
              <td>${acao.how_much || acao.quanto_custa || acao.quanto || 'A estimar'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateCadeiaValorHTML(contexto: any): string {
  const mapeamento = contexto.mapeamento || {};
  const cadeia = mapeamento.cadeia_valor || contexto.cadeia_valor || {};

  // Tentar obter processos de múltiplas fontes
  let processosPrimarios = cadeia.processos_primarios || mapeamento.processos_primarios || [];
  let processosApoio = cadeia.processos_apoio || mapeamento.processos_apoio || [];
  let processosGestao = cadeia.processos_gestao || mapeamento.processos_gestao || [];

  // Se não tiver categorização, tentar inferir da lista geral
  const processosIdentificados = mapeamento.processos_identificados || [];
  if (processosPrimarios.length === 0 && processosIdentificados.length > 0) {
    // Palavras-chave para categorizar automaticamente
    const palavrasPrimarias = ['venda', 'marketing', 'operação', 'produção', 'entrega', 'logística', 'onboarding', 'tesouraria'];
    const palavrasApoio = ['financeiro', 'ti', 'tecnologia', 'rh', 'pessoas', 'suporte', 'infraestrutura'];
    const palavrasGestao = ['gestão', 'planejamento', 'estratégia', 'controle', 'administração'];

    processosIdentificados.forEach((p: any) => {
      const nome = (typeof p === 'string' ? p : p.nome || '').toLowerCase();
      if (palavrasPrimarias.some(palavra => nome.includes(palavra))) {
        processosPrimarios.push(p);
      } else if (palavrasGestao.some(palavra => nome.includes(palavra))) {
        processosGestao.push(p);
      } else if (palavrasApoio.some(palavra => nome.includes(palavra))) {
        processosApoio.push(p);
      } else {
        // Por padrão, considerar primário
        processosPrimarios.push(p);
      }
    });
  }

  const empresa = contexto.empresa || contexto.anamnese?.empresa || mapeamento.empresa || 'Empresa';
  const proposta_valor = mapeamento.canvas_proposta_valor || mapeamento.proposta_valor || 'criação de valor';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cadeia de Valor - ${empresa}</title>
  ${BASE_STYLES}
  <style>
    .chain { border: 3px solid ${BRAND_COLORS.primary}; padding: 1.5rem; border-radius: 12px; margin: 1rem 0; }
    .chain-primary { background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); }
    .chain-support { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); }
    .chain-management { background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Cadeia de Valor</h1>
      <p>Arquitetura de processos da ${empresa}</p>
    </div>

    <div class="section">
      <h2>Resumo Executivo</h2>
      <p style="line-height: 1.8; margin-bottom: 1rem;">
        A cadeia de valor da <strong>${empresa}</strong> foi mapeada para identificar todos os processos que contribuem para <strong>${proposta_valor}</strong>.
        ${processosPrimarios.length > 0 ? `As principais entregas de valor são realizadas através de <strong>${processosPrimarios.length} processos primários</strong>` : ''}
        ${processosApoio.length > 0 ? `, suportados por <strong>${processosApoio.length} processos de apoio</strong>` : ''}
        ${processosGestao.length > 0 ? ` e <strong>${processosGestao.length} processos gerenciais</strong>` : ''}.
      </p>
    </div>

    <div class="section">
      <h2>Atividades Primárias</h2>
      <p>Processos que geram valor direto ao cliente:</p>
      ${processosPrimarios.length > 0 ? `
      <div class="chain chain-primary">
        ${processosPrimarios.map((p: any) => `
          <div class="card">
            <h4>⚙️ ${typeof p === 'string' ? p : p.nome || p}</h4>
            ${(typeof p !== 'string' && p.descricao) ? `<p>${p.descricao}</p>` : ''}
          </div>
        `).join('')}
      </div>
      ` : '<p style="color: #6b7280; font-style: italic;">Nenhum processo primário identificado ainda.</p>'}
    </div>

    <div class="section">
      <h2>Atividades de Gestão</h2>
      <p>Processos que coordenam e controlam as operações:</p>
      ${processosGestao.length > 0 ? `
      <div class="chain chain-management">
        ${processosGestao.map((p: any) => `
          <div class="card">
            <h4>📊 ${typeof p === 'string' ? p : p.nome || p}</h4>
            ${(typeof p !== 'string' && p.descricao) ? `<p>${p.descricao}</p>` : ''}
          </div>
        `).join('')}
      </div>
      ` : '<p style="color: #6b7280; font-style: italic;">Nenhum processo gerencial identificado ainda.</p>'}
    </div>

    <div class="section">
      <h2>Atividades de Apoio</h2>
      <p>Processos que suportam as atividades primárias:</p>
      ${processosApoio.length > 0 ? `
      <div class="chain chain-support">
        ${processosApoio.map((p: any) => `
          <div class="card">
            <h4>🛠️ ${typeof p === 'string' ? p : p.nome || p}</h4>
            ${(typeof p !== 'string' && p.descricao) ? `<p>${p.descricao}</p>` : ''}
          </div>
        `).join('')}
      </div>
      ` : '<p style="color: #6b7280; font-style: italic;">Nenhum processo de apoio identificado ainda.</p>'}
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateIshikawaHTML(contexto: any): string {
  const ishikawa = contexto.ishikawa || contexto;
  const categorias = ishikawa.categorias_6m || {};

  // Função para sanitizar texto (remover HTML tags)
  function sanitizeText(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  // Sanitizar categorias
  const categoriasSanitizadas: any = {};
  Object.keys(categorias).forEach(key => {
    const valores = categorias[key];
    if (Array.isArray(valores)) {
      categoriasSanitizadas[key] = valores.map(v => sanitizeText(String(v)));
    } else {
      categoriasSanitizadas[key] = [];
    }
  });

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagrama Ishikawa - ${contexto.empresa || 'Análise'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐟 Diagrama de Ishikawa (6M)</h1>
      <p>Análise de causas por categoria</p>
    </div>

    <div class="section">
      <h2>Problema Analisado</h2>
      <div class="card" style="background: #fee2e2; border-color: #ef4444;">
        <h3>⚠️ ${sanitizeText(ishikawa.dor || ishikawa.problema || 'Problema não especificado')}</h3>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h4>📦 Máquina</h4>
        <ul>
          ${(categoriasSanitizadas.maquina || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>📝 Método</h4>
        <ul>
          ${(categoriasSanitizadas.metodo || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>🧱 Material</h4>
        <ul>
          ${(categoriasSanitizadas.material || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>👥 Mão de Obra</h4>
        <ul>
          ${(categoriasSanitizadas.mao_obra || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>🌳 Meio Ambiente</h4>
        <ul>
          ${(categoriasSanitizadas.meio_ambiente || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>📊 Medição</h4>
        <ul>
          ${(categoriasSanitizadas.medicao || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="section">
      <h2>Causa Raiz Identificada</h2>
      <div class="card" style="background: #dcfce7; border-color: #10b981;">
        <h3>🎯 ${sanitizeText(ishikawa.causa_raiz || 'Não identificada')}</h3>
      </div>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generate5WhysHTML(contexto: any): string {
  const whys = contexto.whys || contexto;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>5 Porquês - ${contexto.empresa || 'Análise'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❓ Método dos 5 Porquês</h1>
      <p>Identificação de causa raiz</p>
    </div>

    <div class="section">
      <h2>Problema Inicial</h2>
      <div class="card" style="background: #fee2e2;">
        <h3>🚨 ${whys.problema || 'Não especificado'}</h3>
      </div>
    </div>

    <div class="section">
      <h2>Análise de Causas</h2>
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Pergunta</th>
            <th>Resposta</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1</strong></td>
            <td>Por quê?</td>
            <td>${whys.porque_1 || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>2</strong></td>
            <td>Por quê?</td>
            <td>${whys.porque_2 || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>3</strong></td>
            <td>Por quê?</td>
            <td>${whys.porque_3 || 'N/A'}</td>
          </tr>
          <tr>
            <td><strong>4</strong></td>
            <td>Por quê?</td>
            <td>${whys.porque_4 || 'N/A'}</td>
          </tr>
          <tr style="background: #dcfce7;">
            <td><strong>5</strong></td>
            <td><strong>Por quê?</strong></td>
            <td><strong>${whys.porque_5 || 'N/A'}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Causa Raiz Final</h2>
      <div class="card" style="background: #dcfce7; border-left: 4px solid #10b981;">
        <h3>🎯 ${whys.causa_raiz || 'Não identificada'}</h3>
      </div>
      ${whys.processos_afetados && whys.processos_afetados.length > 0 ? `
        <h3>Processos Afetados</h3>
        <ul>
          ${whys.processos_afetados.map((p: string) => `<li><strong>${p}</strong></li>`).join('')}
        </ul>
      ` : ''}
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generateBPMNHTML(contexto: any): string {
  const bpmn = contexto.bpmn || contexto;
  let bpmnXML = bpmn.xml || bpmn.bpmn_xml || '';
  const processoNome = bpmn.processo_nome || bpmn.nome || 'Processo';
  const sipoc = bpmn.sipoc || contexto.sipoc || {};

  // Função auxiliar para escapar XML
  function escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Se não tiver XML, gerar um BPMN detalhado baseado em SIPOC (se disponível)
  if (!bpmnXML || bpmnXML.trim().length < 50) {
    const steps = sipoc.process_steps || sipoc.process || [];

    if (steps.length > 0) {
      // Gerar BPMN com múltiplas tarefas baseadas nos passos do SIPOC
      let tasksXml = '';
      let flowsXml = '';
      let diagramXml = '';
      let xPos = 180;
      const yPos = 80;

      steps.forEach((step: string, index: number) => {
        const taskId = `Task_${index + 1}`;
        const flowIdIn = index === 0 ? 'Flow_Start' : `Flow_${index}`;
        const flowIdOut = `Flow_${index + 1}`;
        const prevId = index === 0 ? 'StartEvent_1' : `Task_${index}`;
        const nextId = index === steps.length - 1 ? 'EndEvent_1' : `Task_${index + 2}`;

        const stepName = escapeXml(typeof step === 'string' ? step : step.toString());

        tasksXml += `
    <bpmn:task id="${taskId}" name="${stepName}">
      <bpmn:incoming>${flowIdIn}</bpmn:incoming>
      <bpmn:outgoing>${flowIdOut}</bpmn:outgoing>
    </bpmn:task>`;

        flowsXml += `
    <bpmn:sequenceFlow id="${flowIdOut}" sourceRef="${taskId}" targetRef="${nextId}" />`;

        diagramXml += `
      <bpmndi:BPMNShape id="${taskId}_di" bpmnElement="${taskId}">
        <dc:Bounds x="${xPos}" y="${yPos}" width="100" height="80" />
      </bpmndi:BPMNShape>`;

        xPos += 150;
      });

      bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Início">
      <bpmn:outgoing>Flow_Start</bpmn:outgoing>
    </bpmn:startEvent>${tasksXml}
    <bpmn:endEvent id="EndEvent_1" name="Fim">
      <bpmn:incoming>Flow_${steps.length}</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start" sourceRef="StartEvent_1" targetRef="Task_1" />${flowsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>${diagramXml}
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="${xPos}" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    } else {
      // Fallback: BPMN básico com 3 etapas genéricas
      const nomeEscapado = escapeXml(processoNome);
      bpmnXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Início">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Receber Demanda (${nomeEscapado})">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_2" name="Executar ${nomeEscapado}">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_3" name="Entregar Resultado">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="EndEvent_1" name="Fim">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="Task_3" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_3" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="240" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="390" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="540" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="692" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }
  }

  const finalXML = bpmnXML;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BPMN - ${processoNome}</title>
  ${BASE_STYLES}
  <script src="https://unpkg.com/bpmn-js@17/dist/bpmn-navigated-viewer.production.min.js"></script>
  <style>
    #canvas { height: 600px; border: 2px solid ${BRAND_COLORS.border}; border-radius: 8px; background: white; }
    .bpmn-icon { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 BPMN - ${processoNome}</h1>
      <p>Modelagem de processo em BPMN 2.0</p>
    </div>

    <div class="section">
      <h2>Diagrama do Processo</h2>
      <div id="canvas"></div>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>

  <script>
    const bpmnXML = \`${finalXML.replace(/`/g, '\\`')}\`;
    const viewer = new BpmnJS({ container: '#canvas' });

    viewer.importXML(bpmnXML).then(() => {
      viewer.get('canvas').zoom('fit-viewport');
    }).catch(err => {
      console.error('Error rendering BPMN:', err);
      document.getElementById('canvas').innerHTML = '<p style="padding: 2rem; text-align: center; color: #ef4444;">Erro ao renderizar diagrama BPMN. Verifique o XML fornecido.</p>';
    });
  </script>
</body>
</html>
`;
}

export function generateSIPOCHTML(contexto: any): string {
  const sipoc = contexto.sipoc || contexto;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIPOC - ${sipoc.processo_nome || 'Processo'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 SIPOC - ${sipoc.processo_nome || 'Processo'}</h1>
      <p>Mapeamento estruturado do processo</p>
    </div>

    <div class="grid">
      <div class="card">
        <h4>📦 Suppliers (Fornecedores)</h4>
        <ul>
          ${(sipoc.suppliers || []).map((s: string) => `<li>${s}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>⬇️ Inputs (Entradas)</h4>
        <ul>
          ${(sipoc.inputs || []).map((i: string) => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="section">
      <h2>⚙️ Process (Processo)</h2>
      <ol>
        ${(sipoc.process_steps || sipoc.process || []).map((step: string) => `
          <li><strong>${step}</strong></li>
        `).join('')}
      </ol>
    </div>

    <div class="grid">
      <div class="card">
        <h4>⬆️ Outputs (Saídas)</h4>
        <ul>
          ${(sipoc.outputs || []).map((o: string) => `<li>${o}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <h4>👥 Customers (Clientes)</h4>
        <ul>
          ${(sipoc.customers || []).map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    </div>

    ${sipoc.metricas ? `
      <div class="section">
        <h2>📊 Métricas e Metas</h2>
        <p>${sipoc.metricas}</p>
      </div>
    ` : ''}

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateEscopoHTML(contexto: any): string {
  const escopo = contexto.escopo || {};
  let processosEscopo = contexto.processos_escopo || escopo.processos_escopo || [];
  let justificativa = contexto.justificativa || escopo.justificativa || '';
  const empresa = contexto.empresa || contexto.anamnese?.empresa || 'Empresa';

  // FALLBACK ROBUSTO: Se não tiver processos no escopo, usar múltiplas fontes
  if (processosEscopo.length === 0) {
    // Tentar da matriz de priorização
    const priorizacao = contexto.priorizacao || {};
    let processosPriorizados = contexto.processos ||
                                 priorizacao.processos ||
                                 priorizacao.processos_priorizados ||
                                 contexto.matriz_gut ||
                                 [];

    // Se ainda não tem, tentar da cadeia de valor
    if (processosPriorizados.length === 0) {
      const mapeamento = contexto.mapeamento || {};
      const processosPrimarios = mapeamento.processos_primarios || contexto.processos_primarios || [];
      const processosGestao = mapeamento.processos_gestao || contexto.processos_gestao || [];

      processosPriorizados = [...processosPrimarios, ...processosGestao].slice(0, 5);
    }

    // Pegar os top 5 processos priorizados
    if (processosPriorizados.length > 0) {
      processosEscopo = processosPriorizados
        .slice(0, 5)
        .map((p: any, i: number) => {
          const nome = typeof p === 'string' ? p : (p.nome || p.processo);
          return {
            nome,
            prioridade: i < 3 ? 'Alta' : 'Média',
            justificativa: `Processo selecionado para otimização baseado em ${i < 2 ? 'impacto crítico' : 'relevância estratégica'} identificado na análise`
          };
        });

      justificativa = justificativa || `Com base na análise de priorização, foram selecionados ${processosEscopo.length} processos críticos que apresentam maior impacto nos resultados da empresa. Este escopo inicial foca nas áreas de maior urgência e potencial de retorno, permitindo resultados rápidos e tangíveis.`;
    }
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escopo do Projeto - ${empresa}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Escopo do Projeto</h1>
      <p>Definição dos processos que serão trabalhados</p>
    </div>

    <div class="section">
      <h2>Processos no Escopo</h2>
      ${processosEscopo.length > 0 ? `
        <div class="grid">
          ${processosEscopo.map((p: any, i: number) => `
            <div class="card">
              <h4>${i + 1}. ${typeof p === 'string' ? p : p.nome || p.processo}</h4>
              ${typeof p === 'object' && p.justificativa ? `<p><strong>Justificativa:</strong> ${p.justificativa}</p>` : ''}
              ${typeof p === 'object' && p.prioridade ? `<p><strong>Prioridade:</strong> ${p.prioridade}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '<p>Nenhum processo definido no escopo.</p>'}
    </div>

    ${justificativa ? `
    <div class="section">
      <h2>Justificativa do Escopo</h2>
      <p style="line-height: 1.8;">${justificativa}</p>
    </div>
    ` : ''}

    <div class="section">
      <h2>Fora do Escopo</h2>
      <p>Todos os demais processos identificados que não estão listados acima estão fora do escopo inicial do projeto e poderão ser abordados em fases futuras.</p>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateDiagnosticoExecutivoHTML(contexto: any): string {
  const diagnostico = contexto.diagnostico || {};
  const processosCriticos = diagnostico.processos_criticos || contexto.processos_criticos || [];
  const principais_dores = diagnostico.principais_dores || contexto.principais_dores || [];
  const recomendacoes = diagnostico.recomendacoes || contexto.recomendacoes || [];

  // Função para sanitizar texto (remover HTML tags, manter apenas texto)
  function sanitizeText(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  // Função para extrair texto limpo de objetos complexos
  function extractCleanText(obj: any): string {
    if (typeof obj === 'string') return sanitizeText(obj);
    if (typeof obj === 'object') {
      return sanitizeText(obj.descricao || obj.texto || obj.nome || obj.conteudo || JSON.stringify(obj));
    }
    return String(obj);
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagnóstico Executivo - ${contexto.empresa || contexto.anamnese?.empresa || 'Empresa'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Diagnóstico Executivo</h1>
      <p>Consolidação de achados e análise estratégica</p>
    </div>

    ${processosCriticos.length > 0 ? `
    <div class="section">
      <h2>🎯 Processos Críticos Mapeados</h2>
      ${processosCriticos.map((p: any, i: number) => `
        <div class="card">
          <h4>${i + 1}. ${extractCleanText(typeof p === 'string' ? p : p.nome || p.processo)}</h4>
          <p>${typeof p === 'object' ? extractCleanText(p.descricao || p.problema || '') : ''}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${principais_dores.length > 0 ? `
    <div class="section">
      <h2>⚠️ Principais Dores Identificadas</h2>
      <ul>
        ${principais_dores.map((d: any) => `
          <li><strong>${extractCleanText(d)}</strong></li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${recomendacoes.length > 0 ? `
    <div class="section">
      <h2>💡 Recomendações Estratégicas</h2>
      ${recomendacoes.map((r: any, i: number) => `
        <div class="card">
          <h4>Recomendação ${i + 1}</h4>
          <p>${extractCleanText(r)}</p>
          ${typeof r === 'object' && r.impacto ? `<p><strong>Impacto:</strong> ${extractCleanText(r.impacto)}</p>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section">
      <h2>📊 Resumo Geral</h2>
      <p>${sanitizeText(diagnostico.resumo || 'Diagnóstico consolidado com base na anamnese, mapeamento de processos e investigação de causas raiz.')}</p>
    </div>

    <div class="footer">
      <p>Gerado automaticamente por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}

export function getTemplateForType(tipo: string, contexto: any): string {
  const templates: Record<string, (ctx: any) => string> = {
    'anamnese': generateAnamneseHTML,
    'anamnese_empresarial': generateAnamneseHTML,
    'relatorio_anamnese': generateAnamneseHTML,
    'canvas': generateCanvasHTML,
    'canvas_model': generateCanvasHTML,
    'value_chain': generateCadeiaValorHTML,
    'cadeia_valor': generateCadeiaValorHTML,
    'ishikawa': generateIshikawaHTML,
    'analise_causa_raiz': generateIshikawaHTML,
    'causa_raiz': generateIshikawaHTML,
    '5whys': generate5WhysHTML,
    '5_porques': generate5WhysHTML,
    'sipoc': generateSIPOCHTML,
    'bpmn': generateBPMNHTML,
    'bpmn_as_is': generateBPMNHTML,
    'bpmn_to_be': generateBPMNHTML,
    'matriz_priorizacao': generateMatrizPriorizacaoHTML,
    'escopo': generateEscopoHTML,
    'escopo_projeto': generateEscopoHTML,
    '5w2h': generatePlanoAcaoHTML,
    'plano_acao': generatePlanoAcaoHTML,
    'diagnostico_executivo': generateDiagnosticoExecutivoHTML,
    'diagnostico': generateDiagnosticoExecutivoHTML
  };

  const template = templates[tipo.toLowerCase()];
  if (template) {
    return template(contexto);
  }

  // Template genérico para tipos não mapeados
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${tipo} - Entregável</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${tipo}</h1>
      <p>Documento gerado automaticamente</p>
    </div>
    <div class="section">
      <pre>${JSON.stringify(contexto, null, 2)}</pre>
    </div>
    <div class="footer">
      <p>Gerado por PROCEDA Consultor IA • ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>
`;
}
