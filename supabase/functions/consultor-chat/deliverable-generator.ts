// supabase/functions/consultor-chat/deliverable-generator.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

export class DeliverableGenerator {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private openaiKey: string
  ) {}

  async generateAndSave(tipo: string, jornada: any, contexto: string) {
    // Dados auxiliares para matriz de priorização
    let extra: any = {};
    if (tipo === 'matriz-priorizacao' || tipo === 'matriz_priorizacao') {
      const { data: processos } = await this.supabase
        .from('cadeia_valor_processos')
        .select('id,nome,criticidade,impacto,esforco')
        .eq('jornada_id', jornada.id);

      // Calcula score simples: impacto*criticidade / (esforco||1)
      const linhas = (processos || []).map((p: any) => {
        const imp = Number(p.impacto || 1);
        const cri = Number(p.criticidade || 1);
        const esf = Math.max(1, Number(p.esforco || 1));
        const score = Math.round((imp * cri) / esf * 100) / 100;
        return { ...p, score };
      }).sort((a: any, b: any) => b.score - a.score);

      extra.processos = linhas;
    }

    const html = await this.buildHTML(tipo, jornada, contexto, extra);
    const nome = this.prettyName(tipo);
    await this.save(jornada.id, tipo, nome, html, jornada.etapa_atual);
  }

  async generateDeliverable(tipo: string, jornada: any, contexto: string): Promise<{ html: string; nome: string }> {
    let extra: any = {};
    if (tipo === 'matriz-priorizacao' || tipo === 'matriz_priorizacao') {
      const { data: processos } = await this.supabase
        .from('cadeia_valor_processos')
        .select('id,nome,criticidade,impacto,esforco')
        .eq('jornada_id', jornada.id);

      const linhas = (processos || []).map((p: any) => {
        const imp = Number(p.impacto || 1);
        const cri = Number(p.criticidade || 1);
        const esf = Math.max(1, Number(p.esforco || 1));
        const score = Math.round((imp * cri) / esf * 100) / 100;
        return { ...p, score };
      }).sort((a: any, b: any) => b.score - a.score);

      extra.processos = linhas;
    }

    const html = await this.buildHTML(tipo, jornada, contexto, extra);
    const nome = this.prettyName(tipo);
    return { html, nome };
  }

  async saveDeliverable(jornada_id: string, tipo: string, nome: string, html: string, etapa: string) {
    await this.save(jornada_id, tipo, nome, html, etapa);
  }

  private prettyName(tipo: string) {
    switch (tipo) {
      case 'anamnese':
      case 'relatorio':
        return 'Relatório de Anamnese Empresarial';
      case 'canvas': return 'Canvas de Modelo de Negócio';
      case 'cadeia-valor':
      case 'cadeia_valor':
        return 'Cadeia de Valor';
      case 'atributos-processo': return 'Atributos do Processo';
      case 'matriz-priorizacao':
      case 'matriz_priorizacao':
      case 'matriz':
        return 'Matriz de Priorização';
      case 'escopo':
        return 'Escopo do Projeto';
      default: return tipo.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    }
  }

  private async save(jornada_id: string, tipo: string, nome: string, html: string, etapa: string) {
    // Generate slug from tipo
    const slug = tipo.replace(/-/g, '_').toLowerCase();

    // UPSERT: Insert or update if already exists (based on unique constraint jornada_id + slug)
    const { error } = await this.supabase.from('entregaveis_consultor').upsert({
      jornada_id,
      tipo,
      slug,
      nome,
      html_conteudo: html,
      etapa_origem: etapa,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'jornada_id,slug',
      ignoreDuplicates: false // Always update if exists
    });

    if (error) {
      console.error(`[ENTREGAVEL] ❌ Error saving deliverable:`, error);
      throw error;
    }

    console.log(`[ENTREGAVEL] ✅ Saved deliverable (UPSERT) tipo: ${tipo}, slug: ${slug}, nome: ${nome}`);
  }

  private async fillTemplate(template: any, jornada: any, contexto: string, extra?: any): Promise<string> {
    let html = template.html_template || '';
    const ctx = jornada.contexto_coleta || {};

    // CRITICAL: Extract data from nested structures
    // Forms are stored as: ctx.anamnese, ctx.canvas, ctx.cadeia_valor
    const anamneseData = ctx.anamnese || {};
    const canvasData = ctx.canvas || {};
    const cadeiaData = ctx.cadeia_valor || ctx.cadeia || {};

    console.log('[DELIVERABLE] Extracting data from contexto_coleta:', {
      has_anamnese: !!anamneseData,
      has_canvas: !!canvasData,
      has_cadeia: !!cadeiaData,
      anamnese_keys: Object.keys(anamneseData),
      canvas_keys: Object.keys(canvasData),
      cadeia_keys: Object.keys(cadeiaData)
    });

    // Build mapping object with all possible data sources
    const data: Record<string, string> = {
      // Date
      data_geracao: new Date().toLocaleDateString('pt-BR'),

      // From anamnese form (CORRECTED: extract from nested anamnese object)
      empresa_nome: anamneseData.empresa_nome || ctx.empresa_nome || ctx.nome_empresa || '—',
      nome_usuario: anamneseData.nome_usuario || ctx.nome_usuario || '—',
      cargo: anamneseData.cargo || ctx.cargo || '—',
      segmento: anamneseData.segmento || ctx.segmento || ctx.ramo_atuacao || '—',
      porte: anamneseData.porte || ctx.porte || ctx.numero_funcionarios || '—',
      desafios_principais: anamneseData.desafios_principais || ctx.desafios_principais || ctx.desafios || '—',
      desafios_mencionados: anamneseData.desafios_principais || ctx.desafios_principais || ctx.desafios || '—',
      proximos_passos: anamneseData.expectativas || ctx.expectativas || anamneseData.metas_curto_prazo || ctx.metas_curto_prazo || 'A definir conforme evolução do projeto',
      expectativas: anamneseData.expectativas || ctx.expectativas || '—',
      tempo_mercado: anamneseData.tempo_mercado || ctx.tempo_mercado || '—',
      metas_curto_prazo: anamneseData.metas_curto_prazo || ctx.metas_curto_prazo || '—',
      metas_medio_prazo: anamneseData.metas_medio_prazo || ctx.metas_medio_prazo || '—',

      // Canvas fields (CORRECTED: extract from nested canvas object)
      parcerias_principais: canvasData.parcerias_chave || canvasData.parcerias_principais || ctx.parcerias_chave || '—',
      atividades_principais: canvasData.atividades_chave || canvasData.atividades_principais || ctx.atividades_chave || '—',
      proposta_valor: canvasData.proposta_valor || ctx.proposta_valor || '—',
      relacionamento_clientes: canvasData.relacionamento || canvasData.relacionamento_clientes || ctx.relacionamento || '—',
      segmentos_clientes: canvasData.segmentos_clientes || ctx.segmentos_clientes || '—',
      recursos_principais: canvasData.recursos_chave || canvasData.recursos_principais || ctx.recursos_chave || '—',
      canais_distribuicao: canvasData.canais || canvasData.canais_distribuicao || ctx.canais || '—',
      estrutura_custos: canvasData.estrutura_custos || ctx.estrutura_custos || '—',
      fontes_receita: canvasData.fontes_receita || ctx.fontes_receita || '—',
      observacoes_canvas: canvasData.observacoes || ctx.observacoes || '',

      // Cadeia de Valor fields (CORRECTED: extract from nested cadeia object)
      atividades_primarias: cadeiaData.atividades_primarias || cadeiaData.processos_finalisticos || ctx.atividades_primarias || '—',
      atividades_suporte: cadeiaData.atividades_suporte || cadeiaData.processos_apoio || ctx.atividades_suporte || '—',
      inputs_principais: cadeiaData.inputs_principais || ctx.inputs_principais || '—',
      outputs_esperados: cadeiaData.outputs_esperados || ctx.outputs_esperados || '—',

      // Matriz de priorização
      matriz_processos: this.buildMatrizTable(extra?.processos || []),
      processos_prioritarios: this.buildPrioridadesList(extra?.processos || [])
    };

    // Replace all placeholders {{key}} with actual values
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value || '—');
    }

    // Replace any remaining unfilled placeholders with '—'
    html = html.replace(/\{\{[^}]+\}\}/g, '—');

    console.log('[DELIVERABLE] Template filled successfully');

    return html;
  }

  private buildMatrizTable(processos: any[]): string {
    if (!processos || processos.length === 0) {
      return '<p>Nenhum processo mapeado ainda.</p>';
    }

    const rows = processos.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.nome || p.processo_nome || '-'}</td>
        <td>${p.impacto ?? '-'}</td>
        <td>${p.criticidade ?? '-'}</td>
        <td>${p.esforco ?? '-'}</td>
        <td><strong>${p.score ?? '-'}</strong></td>
      </tr>
    `).join('');

    return `
      <table class="matriz-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Processo</th>
            <th>Impacto</th>
            <th>Criticidade</th>
            <th>Esforço</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private buildPrioridadesList(processos: any[]): string {
    if (!processos || processos.length === 0) {
      return '<p>Nenhum processo priorizado.</p>';
    }

    const topProcessos = processos.slice(0, 5);
    const items = topProcessos.map((p, i) =>
      `<li><strong>${i + 1}. ${p.nome || p.processo_nome}</strong> (Score: ${p.score ?? '-'})</li>`
    ).join('');

    return `<ul>${items}</ul>`;
  }

  private async buildHTML(tipo: string, jornada: any, contexto: string, extra?: any): Promise<string> {
    // First, try to fetch from templates_entregaveis table
    const tipoNormalized = tipo.replace(/-/g, '_').replace(/_/g, '-');
    const { data: template } = await this.supabase
      .from('templates_entregaveis')
      .select('*')
      .eq('tipo', tipo)
      .maybeSingle();

    if (!template) {
      const { data: template2 } = await this.supabase
        .from('templates_entregaveis')
        .select('*')
        .eq('tipo', tipoNormalized)
        .maybeSingle();

      if (template2) {
        return await this.fillTemplate(template2, jornada, contexto, extra);
      }
    } else {
      return await this.fillTemplate(template, jornada, contexto, extra);
    }

    // Fallback to inline templates if not found in database
    if (tipo === 'matriz-priorizacao' || tipo === 'matriz_priorizacao') {
      const linhas = (extra?.processos || []) as any[];
      const rows = linhas.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.nome || '-'}</td>
          <td>${p.impacto ?? '-'}</td>
          <td>${p.criticidade ?? '-'}</td>
          <td>${p.esforco ?? '-'}</td>
          <td><strong>${p.score}</strong></td>
        </tr>
      `).join('');

      return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Matriz de Priorização</title>
<style>
  body{font-family:Inter,Arial,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}
  h1{font-size:20px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #374151;padding:8px;font-size:12px}
  th{background:#111827;color:#a5b4fc}
  tr:nth-child(even){background:#0f172a}
  small{color:#9ca3af}
</style>
</head>
<body>
  <h1>Matriz de Priorização</h1>
  <small>Jornada: ${jornada.id} • Etapa: ${jornada.etapa_atual}</small>
  <p style="margin:12px 0 18px">Geração automática baseada nos processos mapeados na Cadeia de Valor (impacto × criticidade ÷ esforço).</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Processo</th><th>Impacto</th><th>Criticidade</th><th>Esforço</th><th>Score</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">Sem processos mapeados.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
    }

    // Fallback genérico — pode ser melhorado com seu template existente
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${this.prettyName(tipo)}</title>
<style>
  body{font-family:Inter,Arial,sans-serif;background:#0b1220;color:#e5e7eb;padding:24px}
  h1{font-size:20px;margin:0 0 16px}
  section{border:1px solid #374151;border-radius:12px;padding:16px;margin:12px 0;background:#0f172a}
  small{color:#9ca3af}
</style>
</head>
<body>
  <h1>${this.prettyName(tipo)}</h1>
  <small>Jornada: ${jornada.id} • Etapa: ${jornada.etapa_atual}</small>
  <section>
    <p>Conteúdo gerado com base no contexto:</p>
    <pre style="white-space:pre-wrap">${(contexto || '').slice(0, 4000)}</pre>
  </section>
</body>
</html>`;
  }
}
