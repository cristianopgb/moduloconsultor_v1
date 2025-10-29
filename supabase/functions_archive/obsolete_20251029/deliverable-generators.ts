// Funções de geração de entregáveis HTML
export async function generateCanvasDeliverable(supabase, jornada) {
  const contexto = jornada.contexto_coleta || {};
  const html = generateCanvasHTML(contexto, jornada);
  if (!html || html.trim().length < 100) {
    console.error('Canvas HTML too short. Skipping.');
    return;
  }
  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: 'Canvas do Modelo de Negócio',
    tipo: 'canvas',
    html_conteudo: html,
    etapa_origem: 'mapeamento',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });
}
export async function generateCadeiaValorDeliverable(supabase, jornada) {
  const contexto = jornada.contexto_coleta || {};
  const html = generateCadeiaValorHTML(contexto, jornada);
  if (!html || html.trim().length < 100) {
    console.error('Cadeia Valor HTML too short. Skipping.');
    return;
  }
  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: 'Cadeia de Valor',
    tipo: 'cadeia_valor',
    html_conteudo: html,
    etapa_origem: 'mapeamento',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });
}
export async function generateMatrizPriorizacaoDeliverable(supabase, jornada) {
  const contexto = jornada.contexto_coleta || {};
  const html = generateMatrizPriorizacaoHTML(contexto, jornada);
  if (!html || html.trim().length < 100) {
    console.error('Matriz HTML too short. Skipping.');
    return;
  }
  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: 'Matriz de Priorização',
    tipo: 'matriz_priorizacao',
    html_conteudo: html,
    etapa_origem: 'priorizacao',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });
}
export async function generateKanbanDeliverable(supabase, jornada, areaName, acoes, areaId) {
  const html = generateKanbanHTML(areaName, acoes, jornada);
  if (!html || html.trim().length < 100) {
    console.error('Kanban HTML too short. Skipping.');
    return;
  }

  // 1. Salvar entregável HTML (mantém para histórico)
  await supabase.from('entregaveis_consultor').insert({
    jornada_id: jornada.id,
    nome: `Kanban de Implementação - ${areaName}`,
    tipo: 'kanban',
    html_conteudo: html,
    etapa_origem: 'execucao',
    visualizado: false,
    data_geracao: new Date().toISOString()
  });

  // 2. NOVO: Salvar cards individuais no sistema Kanban
  if (acoes && acoes.length > 0) {
    const cardsToInsert = acoes.map((acao, index) => ({
      jornada_id: jornada.id,
      area_id: areaId || null,
      titulo: acao.titulo || acao.descricao?.substring(0, 80) || 'Ação sem título',
      descricao: acao.descricao || '',
      responsavel: acao.responsavel || 'Não definido',
      prazo: acao.prazo || 'A definir',
      status: acao.status || 'todo',
      ordem: index,
      dados_5w2h: {
        o_que: acao.o_que || null,
        por_que: acao.por_que || null,
        quem: acao.quem || acao.responsavel || null,
        quando: acao.quando || acao.prazo || null,
        onde: acao.onde || null,
        como: acao.como || null,
        quanto: acao.quanto || null
      }
    }));

    try {
      await supabase.from('kanban_cards').insert(cardsToInsert);
      console.log(`✅ ${cardsToInsert.length} cards salvos no Kanban para ${areaName}`);
    } catch (error) {
      console.error('Erro ao salvar cards no Kanban:', error);
    }
  }
}
function generateCanvasHTML(contexto, jornada) {
  const areas = contexto.areas_mapeadas || [];
  const empresaNome = contexto.empresa_nome || jornada.empresa_nome || 'Empresa';
  const segmento = contexto.segmento || 'N/A';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Model Canvas - ${empresaNome}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; text-align: center; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #64748b; margin-bottom: 30px; }
    .canvas-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-top: 30px; }
    .canvas-box { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 8px; padding: 20px; min-height: 250px; }
    .canvas-box h3 { color: #1e40af; margin-top: 0; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    .canvas-box ul { list-style: disc; padding-left: 20px; margin: 10px 0; }
    .canvas-box li { margin: 8px 0; color: #334155; font-size: 14px; }
    .box-parcerias { grid-column: 1; grid-row: 1 / 3; background: #fef3c7; border-color: #f59e0b; }
    .box-atividades { grid-column: 2; grid-row: 1; background: #dbeafe; border-color: #3b82f6; }
    .box-proposta { grid-column: 3; grid-row: 1 / 3; background: #dcfce7; border-color: #10b981; }
    .box-relacionamento { grid-column: 4; grid-row: 1; background: #fce7f3; border-color: #ec4899; }
    .box-segmentos { grid-column: 5; grid-row: 1 / 3; background: #e0e7ff; border-color: #6366f1; }
    .box-recursos { grid-column: 2; grid-row: 2; background: #dbeafe; border-color: #3b82f6; }
    .box-canais { grid-column: 4; grid-row: 2; background: #fce7f3; border-color: #ec4899; }
    .box-custos { grid-column: 1 / 4; grid-row: 3; background: #fee2e2; border-color: #ef4444; }
    .box-receitas { grid-column: 4 / 6; grid-row: 3; background: #d1fae5; border-color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Business Model Canvas</h1>
    <p class="subtitle">${empresaNome} | ${segmento} | ${new Date().toLocaleDateString('pt-BR', {
    dateStyle: 'long'
  })}</p>

    <div class="canvas-grid">
      <div class="canvas-box box-parcerias">
        <h3>🤝 Parcerias Principais</h3>
        <ul>
          <li>Fornecedores de ${segmento}</li>
          <li>Parceiros estratégicos</li>
          <li>Prestadores de serviço</li>
        </ul>
      </div>

      <div class="canvas-box box-atividades">
        <h3>⚙️ Atividades-Chave</h3>
        <ul>
          ${areas.filter((a)=>a.existe).map((a)=>`<li>${a.nome}: ${a.principais_atividades || 'Operações'}</li>`).join('')}
        </ul>
      </div>

      <div class="canvas-box box-proposta">
        <h3>💎 Proposta de Valor</h3>
        <ul>
          ${contexto.desafios_principais?.map((d)=>`<li>Resolver: ${d}</li>`).join('') || '<li>Definir propostas de valor</li>'}
        </ul>
      </div>

      <div class="canvas-box box-relacionamento">
        <h3>❤️ Relacionamento</h3>
        <ul>
          <li>Atendimento personalizado</li>
          <li>Suporte contínuo</li>
          <li>Comunidade de clientes</li>
        </ul>
      </div>

      <div class="canvas-box box-segmentos">
        <h3>👥 Segmentos de Clientes</h3>
        <ul>
          <li>Clientes de ${segmento}</li>
          <li>Porte: ${contexto.porte || 'Diversos'}</li>
        </ul>
      </div>

      <div class="canvas-box box-recursos">
        <h3>🔧 Recursos Principais</h3>
        <ul>
          ${areas.filter((a)=>a.existe && a.ferramentas).flatMap((a)=>a.ferramentas.map((f)=>`<li>${f}</li>`)).join('') || '<li>Recursos humanos</li><li>Infraestrutura</li>'}
        </ul>
      </div>

      <div class="canvas-box box-canais">
        <h3>📢 Canais</h3>
        <ul>
          <li>Website</li>
          <li>Redes sociais</li>
          <li>Vendas diretas</li>
        </ul>
      </div>

      <div class="canvas-box box-custos">
        <h3>💰 Estrutura de Custos</h3>
        <ul>
          <li>Custos fixos operacionais</li>
          <li>Custos variáveis por venda</li>
          <li>Investimentos em marketing</li>
        </ul>
      </div>

      <div class="canvas-box box-receitas">
        <h3>💵 Fontes de Receita</h3>
        <ul>
          <li>Vendas de produtos/serviços</li>
          <li>Recorrência mensal</li>
          <li>Upsell e cross-sell</li>
        </ul>
      </div>
    </div>

    <p style="text-align: right; color: #64748b; font-style: italic; margin-top: 30px;">
      Gerado automaticamente pelo Proceda IA
    </p>
  </div>
</body>
</html>`;
}
function generateCadeiaValorHTML(contexto, jornada) {
  const areas = contexto.areas_mapeadas || [];
  const empresaNome = contexto.empresa_nome || jornada.empresa_nome || 'Empresa';
  const atividadesPrimarias = areas.filter((a)=>a.existe && [
      'comercial',
      'vendas',
      'marketing',
      'operação',
      'logística',
      'atendimento'
    ].some((termo)=>a.nome.toLowerCase().includes(termo)));
  const atividadesSuporte = areas.filter((a)=>a.existe && [
      'financeiro',
      'rh',
      'ti',
      'administrativo',
      'gestão'
    ].some((termo)=>a.nome.toLowerCase().includes(termo)));
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cadeia de Valor - ${empresaNome}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; text-align: center; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #64748b; margin-bottom: 40px; }
    .section { margin: 30px 0; }
    .section-title { background: #3b82f6; color: white; padding: 12px 20px; border-radius: 8px; font-size: 18px; font-weight: bold; }
    .activities { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
    .activity-card { background: #f8fafc; border-left: 5px solid #3b82f6; padding: 20px; border-radius: 8px; }
    .activity-card h3 { color: #1e40af; margin-top: 0; font-size: 16px; }
    .activity-card p { color: #475569; margin: 10px 0; font-size: 14px; }
    .activity-card ul { list-style: disc; padding-left: 20px; margin: 10px 0; }
    .activity-card li { margin: 5px 0; color: #64748b; font-size: 13px; }
    .support { background: #fef3c7; }
    .support .activity-card { border-left-color: #f59e0b; }
    .support .section-title { background: #f59e0b; }
    .primary { background: #dbeafe; }
    .primary .activity-card { border-left-color: #3b82f6; }
    .margin { text-align: center; background: #dcfce7; padding: 30px; border-radius: 12px; margin-top: 30px; border: 3px solid #10b981; }
    .margin h2 { color: #047857; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cadeia de Valor de Porter</h1>
    <p class="subtitle">${empresaNome} | ${new Date().toLocaleDateString('pt-BR', {
    dateStyle: 'long'
  })}</p>

    <div class="section support">
      <div class="section-title">🔧 Atividades de Suporte</div>
      <div class="activities">
        ${atividadesSuporte.map((a)=>`
          <div class="activity-card">
            <h3>${a.nome}</h3>
            <p><strong>Responsável:</strong> ${a.responsavel || 'Não informado'}</p>
            <p><strong>Atividades:</strong></p>
            <p>${a.principais_atividades || 'Não detalhado'}</p>
            ${a.desafios && a.desafios.length > 0 ? `
              <p><strong>Desafios:</strong></p>
              <ul>${a.desafios.map((d)=>`<li>${d}</li>`).join('')}</ul>
            ` : ''}
          </div>
        `).join('') || '<div class="activity-card"><p>Nenhuma atividade de suporte identificada</p></div>'}
      </div>
    </div>

    <div class="section primary">
      <div class="section-title">⚡ Atividades Primárias (Cadeia de Geração de Valor)</div>
      <div class="activities">
        ${atividadesPrimarias.map((a)=>`
          <div class="activity-card">
            <h3>${a.nome}</h3>
            <p><strong>Responsável:</strong> ${a.responsavel || 'Não informado'}</p>
            <p><strong>Atividades:</strong></p>
            <p>${a.principais_atividades || 'Não detalhado'}</p>
            ${a.ferramentas && a.ferramentas.length > 0 ? `
              <p><strong>Ferramentas:</strong> ${a.ferramentas.join(', ')}</p>
            ` : ''}
            ${a.desafios && a.desafios.length > 0 ? `
              <p><strong>Desafios:</strong></p>
              <ul>${a.desafios.map((d)=>`<li>${d}</li>`).join('')}</ul>
            ` : ''}
          </div>
        `).join('') || '<div class="activity-card"><p>Nenhuma atividade primária identificada</p></div>'}
      </div>
    </div>

    <div class="margin">
      <h2>📈 MARGEM</h2>
      <p>Diferença entre o valor entregue ao cliente e os custos das atividades</p>
      <p><strong>Objetivo:</strong> Maximizar margem através de eficiência operacional e otimização de processos</p>
    </div>

    <p style="text-align: right; color: #64748b; font-style: italic; margin-top: 30px;">
      Gerado automaticamente pelo Proceda IA
    </p>
  </div>
</body>
</html>`;
}
function generateMatrizPriorizacaoHTML(contexto, jornada) {
  const areas = (contexto.areas_mapeadas || []).filter((a)=>a.existe);
  const empresaNome = contexto.empresa_nome || jornada.empresa_nome || 'Empresa';
  // Gerar scores automáticos baseado em heurísticas
  const areasComScore = areas.map((area)=>{
    const numDesafios = Array.isArray(area.desafios) ? area.desafios.length : 1;
    const temFerramentas = area.ferramentas && area.ferramentas.length > 0;
    // Lógica simplificada para scores
    const urgencia = numDesafios >= 2 ? 5 : numDesafios === 1 ? 3 : 2;
    const impacto = area.nome.toLowerCase().includes('financeiro') ? 5 : area.nome.toLowerCase().includes('comercial') || area.nome.toLowerCase().includes('vendas') ? 4 : 3;
    const facilidade = temFerramentas ? 3 : 2;
    const score = urgencia * 2 + impacto * 3 + facilidade;
    return {
      ...area,
      urgencia,
      impacto,
      facilidade,
      score
    };
  });
  // Ordenar por score
  areasComScore.sort((a, b)=>b.score - a.score);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Matriz de Priorização - ${empresaNome}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; text-align: center; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #64748b; margin-bottom: 30px; }
    .legend { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 5px solid #3b82f6; }
    .legend h3 { color: #1e40af; margin-top: 0; }
    .legend p { margin: 8px 0; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    thead { background: #3b82f6; color: white; }
    th { padding: 15px; text-align: left; font-weight: 600; }
    td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
    tbody tr:hover { background: #f8fafc; }
    .score { font-weight: bold; font-size: 18px; }
    .score-high { color: #dc2626; }
    .score-med { color: #f59e0b; }
    .score-low { color: #10b981; }
    .prioridade { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    .pri-1 { background: #dc2626; color: white; }
    .pri-2 { background: #f59e0b; color: white; }
    .pri-3 { background: #10b981; color: white; }
    .roadmap { background: #dbeafe; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 5px solid #2563eb; }
    .roadmap h3 { color: #1e40af; margin-top: 0; }
    .roadmap ol { padding-left: 20px; }
    .roadmap li { margin: 10px 0; color: #334155; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Matriz de Priorização de Áreas</h1>
    <p class="subtitle">${empresaNome} | ${new Date().toLocaleDateString('pt-BR', {
    dateStyle: 'long'
  })}</p>

    <div class="legend">
      <h3>📊 Metodologia de Pontuação</h3>
      <p><strong>Fórmula:</strong> SCORE = (Urgência × 2) + (Impacto × 3) + Facilidade</p>
      <p><strong>Urgência (1-5):</strong> Risco imediato se não resolver</p>
      <p><strong>Impacto (1-5):</strong> Resultado no negócio quando resolvido</p>
      <p><strong>Facilidade (1-5):</strong> Facilidade de implementar melhorias</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Prioridade</th>
          <th>Área</th>
          <th>Urgência</th>
          <th>Impacto</th>
          <th>Facilidade</th>
          <th>Score Total</th>
        </tr>
      </thead>
      <tbody>
        ${areasComScore.map((area, idx)=>{
    const scoreClass = area.score >= 20 ? 'score-high' : area.score >= 15 ? 'score-med' : 'score-low';
    const priClass = idx === 0 ? 'pri-1' : idx === 1 ? 'pri-2' : 'pri-3';
    return `
            <tr>
              <td><span class="prioridade ${priClass}">${idx + 1}º</span></td>
              <td><strong>${area.nome}</strong></td>
              <td>${area.urgencia}</td>
              <td>${area.impacto}</td>
              <td>${area.facilidade}</td>
              <td><span class="score ${scoreClass}">${area.score}</span></td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>

    <div class="roadmap">
      <h3>🎯 ROADMAP DE TRANSFORMAÇÃO DEFINIDO</h3>
      <ol>
        ${areasComScore.map((area, idx)=>`
          <li><strong>${area.nome}</strong> - Score: ${area.score}/25
            ${idx === 0 ? '(Início imediato - base para as demais)' : idx === 1 ? '(Segunda prioridade - após estabilizar primeira)' : '(Terceira onda de melhorias)'}
          </li>
        `).join('')}
      </ol>
      <p style="margin-top: 20px; font-weight: bold; color: #1e40af;">
        ⚡ DECISÃO TÉCNICA: Começaremos por ${areasComScore[0]?.nome} pois é a base que sustenta as demais melhorias.
      </p>
    </div>

    <p style="text-align: right; color: #64748b; font-style: italic; margin-top: 30px;">
      Gerado automaticamente pelo Proceda IA
    </p>
  </div>
</body>
</html>`;
}
function generateKanbanHTML(areaName, acoes, jornada) {
  const todo = acoes.filter((a)=>a.status === 'todo' || !a.status);
  const doing = acoes.filter((a)=>a.status === 'doing');
  const done = acoes.filter((a)=>a.status === 'done');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban de Implementação - ${areaName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f0f4f8; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1e40af; text-align: center; margin-bottom: 30px; }
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; }
    .column { background: #f8fafc; border-radius: 12px; padding: 20px; min-height: 500px; }
    .column-header { font-size: 18px; font-weight: bold; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: white; text-align: center; }
    .col-todo .column-header { background: #64748b; }
    .col-doing .column-header { background: #3b82f6; }
    .col-done .column-header { background: #10b981; }
    .card { background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #cbd5e1; }
    .card h4 { margin: 0 0 10px 0; color: #1e40af; font-size: 15px; }
    .card p { margin: 5px 0; color: #475569; font-size: 13px; }
    .card .meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Kanban de Implementação: ${areaName}</h1>
    <p style="text-align: center; color: #64748b; margin-bottom: 30px;">
      ${new Date().toLocaleDateString('pt-BR', {
    dateStyle: 'long'
  })}
    </p>

    <div class="board">
      <div class="column col-todo">
        <div class="column-header">📋 A FAZER (${todo.length})</div>
        ${todo.map((acao)=>`
          <div class="card">
            <h4>${acao.titulo || acao.descricao?.substring(0, 50)}</h4>
            <p>${acao.descricao || ''}</p>
            <div class="meta">
              <span>👤 ${acao.responsavel || 'Não definido'}</span>
              <span>📅 ${acao.prazo || 'Sem prazo'}</span>
            </div>
          </div>
        `).join('') || '<p style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma ação pendente</p>'}
      </div>

      <div class="column col-doing">
        <div class="column-header">🔄 EM ANDAMENTO (${doing.length})</div>
        ${doing.map((acao)=>`
          <div class="card">
            <h4>${acao.titulo || acao.descricao?.substring(0, 50)}</h4>
            <p>${acao.descricao || ''}</p>
            <div class="meta">
              <span>👤 ${acao.responsavel || 'Não definido'}</span>
              <span>📅 ${acao.prazo || 'Sem prazo'}</span>
            </div>
          </div>
        `).join('') || '<p style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma ação em andamento</p>'}
      </div>

      <div class="column col-done">
        <div class="column-header">✅ CONCLUÍDO (${done.length})</div>
        ${done.map((acao)=>`
          <div class="card">
            <h4>${acao.titulo || acao.descricao?.substring(0, 50)}</h4>
            <p>${acao.descricao || ''}</p>
            <div class="meta">
              <span>👤 ${acao.responsavel || 'Não definido'}</span>
              <span>✓ Concluído</span>
            </div>
          </div>
        `).join('') || '<p style="text-align: center; color: #94a3b8; padding: 20px;">Nenhuma ação concluída ainda</p>'}
      </div>
    </div>

    <p style="text-align: right; color: #64748b; font-style: italic; margin-top: 30px;">
      Gerado automaticamente pelo Proceda IA
    </p>
  </div>
</body>
</html>`;
}
