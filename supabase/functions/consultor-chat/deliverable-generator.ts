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
    if (tipo === 'matriz-priorizacao') {
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

  private prettyName(tipo: string) {
    switch (tipo) {
      case 'canvas': return 'Canvas de Modelo de Negócio';
      case 'cadeia-valor': return 'Cadeia de Valor';
      case 'atributos-processo': return 'Atributos do Processo';
      case 'matriz-priorizacao': return 'Matriz de Priorização';
      default: return tipo.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    }
  }

  private async save(jornada_id: string, slug: string, nome: string, html: string, etapa: string) {
    await this.supabase.from('entregaveis_consultor').insert({
      jornada_id, slug, nome, html, etapa
    });
  }

  private async buildHTML(tipo: string, jornada: any, contexto: string, extra?: any): Promise<string> {
    // Templates simples inline. Se você já tem tabela de templates, pode
    // trocar aqui para buscar `templates_entregaveis`.
    if (tipo === 'matriz-priorizacao') {
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
