-- Templates de Entregáveis para Consultor Proceda
-- Este arquivo popula os templates HTML com placeholders para a LLM preencher

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS templates_entregaveis (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  html_template TEXT NOT NULL,
  placeholders JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Limpar dados existentes
DELETE FROM templates_entregaveis;

-- Template 1: Business Model Canvas
INSERT INTO templates_entregaveis (nome, tipo, categoria, html_template, placeholders) VALUES (
'Business Model Canvas',
'canvas',
'anamnese',
'<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Business Model Canvas - {{empresa_nome}}</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; margin: 20px; }
        .canvas-container { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 10px; height: 80vh; }
        .canvas-block { border: 2px solid #333; padding: 15px; border-radius: 8px; }
        .block-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #333; }
        .block-content { font-size: 12px; line-height: 1.4; }
        .parcerias { background: #ffeb3b; grid-row: 1 / 3; }
        .atividades { background: #4caf50; }
        .proposta { background: #f44336; grid-row: 1 / 3; }
        .relacionamento { background: #2196f3; }
        .segmentos { background: #9c27b0; grid-row: 1 / 3; }
        .recursos { background: #ff9800; }
        .canais { background: #00bcd4; }
        .custos { background: #795548; grid-column: 1 / 4; }
        .receitas { background: #607d8b; grid-column: 4 / 6; }
    </style>
</head>
<body>
    <h1>Business Model Canvas - {{empresa_nome}}</h1>
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
    <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p><strong>Observações:</strong> {{observacoes_canvas}}</p>
        <p><em>Gerado em: {{data_geracao}}</em></p>
    </div>
</body>
</html>',
'["empresa_nome", "parcerias_principais", "atividades_principais", "proposta_valor", "relacionamento_clientes", "segmentos_clientes", "recursos_principais", "canais_distribuicao", "estrutura_custos", "fontes_receita", "observacoes_canvas", "data_geracao"]'::jsonb
);

-- Template 2: Relatório de Anamnese
INSERT INTO templates_entregaveis (nome, tipo, categoria, html_template, placeholders) VALUES (
'Relatório de Anamnese',
'relatorio',
'anamnese',
'<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Anamnese - {{empresa_nome}}</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-left: 4px solid #007bff; padding-left: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-item { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .info-label { font-weight: bold; color: #666; }
        .challenges { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório de Anamnese Empresarial</h1>
        <h2>{{empresa_nome}}</h2>
        <p>Gerado em: {{data_geracao}}</p>
    </div>

    <div class="section">
        <h2>1. Perfil Empresarial</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Proprietário/Responsável:</div>
                <div>{{nome_usuario}} - {{cargo}}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Segmento de Atuação:</div>
                <div>{{segmento}}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Porte da Empresa:</div>
                <div>{{porte}}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>2. Desafios Identificados</h2>
        <div class="challenges">
            <h3>Principais Desafios:</h3>
            {{desafios_mencionados}}
        </div>
    </div>

    <div class="section">
        <h2>3. Próximos Passos</h2>
        <p>{{proximos_passos}}</p>
    </div>
</body>
</html>',
'["empresa_nome", "data_geracao", "nome_usuario", "cargo", "segmento", "porte", "desafios_mencionados", "proximos_passos"]'::jsonb
);

-- Template 3: Matriz de Priorização
INSERT INTO templates_entregaveis (nome, tipo, categoria, html_template, placeholders) VALUES (
'Matriz de Priorização',
'matriz',
'priorizacao',
'<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Matriz de Priorização - {{empresa_nome}}</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .matriz-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .matriz-table th, .matriz-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .matriz-table th { background-color: #f2f2f2; font-weight: bold; }
        .score-alta { background-color: #ffebee; }
        .score-media { background-color: #fff3e0; }
        .score-baixa { background-color: #e8f5e8; }
        .cronograma { background: #e3f2fd; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Matriz de Priorização de Processos</h1>
        <h2>{{empresa_nome}}</h2>
        <p>Gerado em: {{data_geracao}}</p>
    </div>

    <h3>Matriz Completa</h3>
    <table class="matriz-table">
        <thead>
            <tr>
                <th>Processo</th>
                <th>Criticidade</th>
                <th>Urgência</th>
                <th>Impacto</th>
                <th>Dificuldade</th>
                <th>Prazo</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {{matriz_processos}}
        </tbody>
    </table>

    <div class="cronograma">
        <h3>Processos Prioritários</h3>
        {{processos_prioritarios}}
    </div>
</body>
</html>',
'["empresa_nome", "data_geracao", "matriz_processos", "processos_prioritarios"]'::jsonb
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_templates_tipo ON templates_entregaveis(tipo);
CREATE INDEX IF NOT EXISTS idx_templates_categoria ON templates_entregaveis(categoria);
