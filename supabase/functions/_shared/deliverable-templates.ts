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
      <h2>Contexto e Motivação</h2>
      <h3>Principal Dor/Desafio</h3>
      <p>${anamnese.dor_principal || anamnese.desafios_principais || 'Não especificado'}</p>

      <h3>Expectativa de Sucesso</h3>
      <p>${anamnese.expectativa_sucesso || anamnese.expectativas || 'Não especificado'}</p>
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
  const canvas = contexto.mapeamento?.canvas || contexto.canvas || {};

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Model Canvas - ${contexto.empresa || 'Empresa'}</title>
  ${BASE_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Business Model Canvas</h1>
      <p>Modelo de negócio mapeado</p>
    </div>

    <div class="section">
      <h2>Proposta de Valor</h2>
      <p>${canvas.proposta_valor || canvas.value_proposition || 'Não especificado'}</p>
    </div>

    <div class="grid">
      <div class="card">
        <h4>Segmentos de Cliente</h4>
        <p>${canvas.segmentos_cliente || canvas.customer_segments || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Canais</h4>
        <p>${canvas.canais || canvas.channels || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Relacionamento</h4>
        <p>${canvas.relacionamento || canvas.customer_relationships || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Fontes de Receita</h4>
        <p>${canvas.receitas || canvas.revenue_streams || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Recursos Principais</h4>
        <p>${canvas.recursos || canvas.key_resources || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Atividades-Chave</h4>
        <p>${canvas.atividades || canvas.key_activities || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Parcerias</h4>
        <p>${canvas.parcerias || canvas.key_partnerships || 'N/A'}</p>
      </div>
      <div class="card">
        <h4>Estrutura de Custos</h4>
        <p>${canvas.custos || canvas.cost_structure || 'N/A'}</p>
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
  const processos = priorizacao.processos || priorizacao.processos_priorizados || [];

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
  const acoes = plano.acoes || [];

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
              <td><strong>${acao.o_que || acao.nome || 'N/A'}</strong></td>
              <td>${acao.por_que || acao.justificativa || 'N/A'}</td>
              <td>${acao.quem || acao.responsavel || 'A definir'}</td>
              <td>${acao.quando || acao.prazo || 'A definir'}</td>
              <td>${acao.onde || acao.area || 'N/A'}</td>
              <td>${acao.como || 'A definir método'}</td>
              <td>${acao.quanto_custa || 'A estimar'}</td>
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

export function getTemplateForType(tipo: string, contexto: any): string {
  const templates: Record<string, (ctx: any) => string> = {
    'anamnese': generateAnamneseHTML,
    'relatorio_anamnese': generateAnamneseHTML,
    'canvas': generateCanvasHTML,
    'canvas_model': generateCanvasHTML,
    'value_chain': generateCanvasHTML, // Simplificado por enquanto
    'matriz_priorizacao': generateMatrizPriorizacaoHTML,
    'escopo': generateMatrizPriorizacaoHTML,
    '5w2h': generatePlanoAcaoHTML,
    'plano_acao': generatePlanoAcaoHTML
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
