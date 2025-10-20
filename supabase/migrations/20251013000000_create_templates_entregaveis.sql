/*
  # Sistema de Templates para Entregáveis

  1. Estrutura
    - Tabela `templates_entregaveis` para armazenar templates HTML reutilizáveis
    - Placeholders no formato {{nome_placeholder}} que são preenchidos pela LLM

  2. Segurança
    - RLS habilitado
    - Apenas masters podem criar/editar templates
    - Todos podem ler templates
*/

-- Tabela de templates
CREATE TABLE IF NOT EXISTS templates_entregaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  tipo varchar(100) NOT NULL,
  categoria varchar(100) NOT NULL,
  html_template text NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE templates_entregaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler templates ativos"
  ON templates_entregaveis FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Masters podem gerenciar templates"
  ON templates_entregaveis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'master'
    )
  );

-- Template Business Model Canvas
INSERT INTO templates_entregaveis (nome, tipo, categoria, html_template, placeholders, descricao) VALUES (
'Business Model Canvas',
'canvas',
'anamnese',
'<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Business Model Canvas - {{empresa_nome}}</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; margin: 20px; background: #f5f5f5; }
        .canvas-container { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-width: 1400px; margin: 0 auto; }
        .canvas-block { border: 2px solid #333; padding: 15px; border-radius: 8px; min-height: 200px; background: white; }
        .block-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; }
        .block-content { font-size: 12px; line-height: 1.4; }
        .parcerias { background: #ffeb3b; grid-row: 1 / 3; }
        .atividades { background: #4caf50; }
        .proposta { background: #f44336; grid-row: 1 / 3; color: white; }
        .relacionamento { background: #2196f3; color: white; }
        .segmentos { background: #9c27b0; grid-row: 1 / 3; color: white; }
        .recursos { background: #ff9800; }
        .canais { background: #00bcd4; }
        .custos { background: #795548; grid-column: 1 / 4; color: white; }
        .receitas { background: #607d8b; grid-column: 4 / 6; color: white; }
        h1 { text-align: center; color: #333; }
    </style>
</head>
<body>
    <h1>Business Model Canvas - {{empresa_nome}}</h1>
    <p style="text-align: center; color: #666; margin-bottom: 30px;"><em>Gerado em: {{data_geracao}}</em></p>

    <div class="canvas-container">
        <div class="canvas-block parcerias">
            <div class="block-title">Parcerias Principais</div>
            <div class="block-content">{{parcerias_principais}}</div>
        </div>

        <div class="canvas-block atividades">
            <div class="block-title">Atividades Principais</div>
            <div class="block-content">{{atividades_principais}}</div>
        </div>

        <div class="canvas-block proposta">
            <div class="block-title">Proposta de Valor</div>
            <div class="block-content">{{proposta_valor}}</div>
        </div>

        <div class="canvas-block relacionamento">
            <div class="block-title">Relacionamento</div>
            <div class="block-content">{{relacionamento_clientes}}</div>
        </div>

        <div class="canvas-block segmentos">
            <div class="block-title">Segmentos de Clientes</div>
            <div class="block-content">{{segmentos_clientes}}</div>
        </div>

        <div class="canvas-block recursos">
            <div class="block-title">Recursos Principais</div>
            <div class="block-content">{{recursos_principais}}</div>
        </div>

        <div class="canvas-block canais">
            <div class="block-title">Canais</div>
            <div class="block-content">{{canais_distribuicao}}</div>
        </div>

        <div class="canvas-block custos">
            <div class="block-title">Estrutura de Custos</div>
            <div class="block-content">{{estrutura_custos}}</div>
        </div>

        <div class="canvas-block receitas">
            <div class="block-title">Fontes de Receita</div>
            <div class="block-content">{{fontes_receita}}</div>
        </div>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 8px; max-width: 1400px; margin: 30px auto;">
        <h3>Observações</h3>
        <p>{{observacoes_canvas}}</p>
        <p style="text-align: right; color: #666; font-style: italic; margin-top: 20px;">
            Documento gerado automaticamente pelo Proceda IA
        </p>
    </div>
</body>
</html>',
'["empresa_nome", "data_geracao", "parcerias_principais", "atividades_principais", "proposta_valor", "relacionamento_clientes", "segmentos_clientes", "recursos_principais", "canais_distribuicao", "estrutura_custos", "fontes_receita", "observacoes_canvas"]'::jsonb,
'Template visual do Business Model Canvas para a etapa de Anamnese'
);

-- Template Relatório de Anamnese
INSERT INTO templates_entregaveis (nome, tipo, categoria, html_template, placeholders, descricao) VALUES (
'Relatório de Anamnese Empresarial',
'relatorio',
'anamnese',
'<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Anamnese - {{empresa_nome}}</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; margin: 40px; line-height: 1.6; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
        h1 { color: #2563eb; margin: 0; }
        h2 { color: #1e40af; margin-top: 30px; border-left: 4px solid #3b82f6; padding-left: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-item { background: #f8fafc; padding: 15px; border-radius: 8px; }
        .info-label { font-weight: bold; color: #1e40af; margin-bottom: 5px; }
        .info-value { color: #334155; }
        .section { margin-bottom: 30px; }
        ul { list-style: none; padding-left: 0; }
        li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        li:last-child { border-bottom: none; }
        .highlight-box { background: #dbeafe; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Relatório de Anamnese Empresarial</h1>
            <h2 style="margin-top: 10px; border: none; padding: 0;">{{empresa_nome}}</h2>
            <p style="color: #64748b; margin-top: 10px;">Gerado em: {{data_geracao}}</p>
        </div>

        <div class="section">
            <h2>1. Perfil do Responsável</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Nome</div>
                    <div class="info-value">{{nome_usuario}}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Cargo</div>
                    <div class="info-value">{{cargo}}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>2. Perfil da Empresa</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Segmento</div>
                    <div class="info-value">{{segmento}}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Porte</div>
                    <div class="info-value">{{porte}}</div>
                </div>
            </div>
            <p>{{descricao_negocio}}</p>
        </div>

        <div class="section">
            <h2>3. Desafios e Oportunidades</h2>
            <div class="highlight-box">
                <h3 style="margin-top: 0; color: #1e40af;">Principais Desafios Identificados</h3>
                <div>{{desafios_principais}}</div>
            </div>
            <div class="highlight-box" style="background: #d1fae5; border-color: #10b981;">
                <h3 style="margin-top: 0; color: #065f46;">Oportunidades de Melhoria</h3>
                <div>{{oportunidades_identificadas}}</div>
            </div>
        </div>

        <div class="section">
            <h2>4. Próximos Passos</h2>
            <p>{{proximos_passos}}</p>
        </div>

        <p style="text-align: right; color: #64748b; font-style: italic; margin-top: 40px;">
            Documento gerado automaticamente pelo Proceda IA
        </p>
    </div>
</body>
</html>',
'["empresa_nome", "data_geracao", "nome_usuario", "cargo", "segmento", "porte", "descricao_negocio", "desafios_principais", "oportunidades_identificadas", "proximos_passos"]'::jsonb,
'Relatório completo da etapa de Anamnese com informações estruturadas'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_templates_tipo ON templates_entregaveis(tipo);
CREATE INDEX IF NOT EXISTS idx_templates_categoria ON templates_entregaveis(categoria);
CREATE INDEX IF NOT EXISTS idx_templates_ativo ON templates_entregaveis(ativo);
