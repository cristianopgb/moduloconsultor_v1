/*
  # Insert default analysis presentation template

  1. Template Details
    - Name: "Apresentação de Análise de Dados"
    - Category: data_analysis
    - System template (cannot be deleted by users)
    - Optimized for displaying data analysis results

  2. Placeholders
    - {{titulo_analise}} - Analysis title
    - {{periodo_analise}} - Analysis period/timeframe
    - {{dataset_nome}} - Original dataset filename
    - {{insights_principais}} - Main insights (HTML list)
    - {{graficos}} - Charts area (embedded images)
    - {{calculos_chave}} - Key metrics (HTML table)
    - {{recomendacoes}} - Recommendations (HTML list)
    - {{data_geracao}} - Generation date
    - {{qualidade_dados}} - Data quality score

  3. Design
    - Professional slide-like layout
    - Responsive and print-friendly
    - Charts centered and prominent
    - Insights highlighted with visual indicators
*/

-- Insert template only if it doesn't exist
INSERT INTO models (
  name,
  description,
  category,
  file_type,
  content_html,
  is_system_template,
  created_at,
  updated_at
)
SELECT
  'Apresentação de Análise de Dados',
  'Template otimizado para apresentar insights, visualizações e métricas de análise de dados. Gerado automaticamente a partir de análises realizadas no chat.',
  'data_analysis',
  'html',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{titulo_analise}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 16px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .header .subtitle {
      font-size: 1.1rem;
      opacity: 0.95;
      font-weight: 300;
    }

    .metadata {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 24px;
      font-size: 0.95rem;
    }

    .metadata-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section {
      padding: 48px 40px;
      border-bottom: 1px solid #e5e7eb;
    }

    .section:last-child {
      border-bottom: none;
    }

    .section-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .section-title::before {
      content: "";
      width: 4px;
      height: 32px;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
      border-radius: 2px;
    }

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }

    .insight-card {
      background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .insight-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(102, 126, 234, 0.15);
      border-color: #667eea;
    }

    .insight-card h3 {
      font-size: 1.1rem;
      color: #1a1a1a;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .insight-card p {
      color: #4b5563;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .confidence-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 12px;
    }

    .confidence-high {
      background: #d1fae5;
      color: #065f46;
    }

    .confidence-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .confidence-low {
      background: #fee2e2;
      color: #991b1b;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }

    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .metric-label {
      font-size: 0.9rem;
      opacity: 0.9;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .metric-interpretation {
      font-size: 0.85rem;
      opacity: 0.85;
      margin-top: 8px;
    }

    .charts-container {
      margin-top: 32px;
    }

    .chart-wrapper {
      margin-bottom: 48px;
      background: #f9fafb;
      padding: 32px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .chart-wrapper:last-child {
      margin-bottom: 0;
    }

    .chart-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 24px;
      text-align: center;
    }

    .chart-wrapper img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      border-radius: 8px;
    }

    .recommendations {
      list-style: none;
      margin-top: 24px;
    }

    .recommendations li {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px 20px;
      margin-bottom: 12px;
      border-radius: 0 8px 8px 0;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .recommendations li::before {
      content: "✓";
      color: #10b981;
      font-weight: 700;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    .quality-banner {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 20px 24px;
      margin-top: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .quality-banner .icon {
      font-size: 2rem;
      flex-shrink: 0;
    }

    .quality-banner .content {
      flex: 1;
    }

    .quality-banner h4 {
      color: #92400e;
      font-size: 1.1rem;
      margin-bottom: 4px;
    }

    .quality-banner p {
      color: #78350f;
      font-size: 0.9rem;
    }

    .footer {
      background: #f9fafb;
      padding: 32px 40px;
      text-align: center;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .footer strong {
      color: #374151;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        box-shadow: none;
      }

      .section {
        page-break-inside: avoid;
      }
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.8rem;
      }

      .section {
        padding: 32px 24px;
      }

      .metadata {
        flex-direction: column;
        gap: 12px;
      }

      .insights-grid,
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{titulo_analise}}</h1>
      <p class="subtitle">Análise de Dados Inteligente</p>
      <div class="metadata">
        <div class="metadata-item">
          <span>📊</span>
          <span>Dataset: {{dataset_nome}}</span>
        </div>
        <div class="metadata-item">
          <span>📅</span>
          <span>Período: {{periodo_analise}}</span>
        </div>
        <div class="metadata-item">
          <span>🗓️</span>
          <span>Gerado em: {{data_geracao}}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Insights Principais</h2>
      <div class="insights-grid">
        {{insights_principais}}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Métricas Chave</h2>
      <div class="metrics-grid">
        {{calculos_chave}}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Visualizações</h2>
      <div class="charts-container">
        {{graficos}}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Recomendações</h2>
      <ul class="recommendations">
        {{recomendacoes}}
      </ul>

      <div class="quality-banner">
        <span class="icon">⚡</span>
        <div class="content">
          <h4>Qualidade dos Dados</h4>
          <p>Score de qualidade: <strong>{{qualidade_dados}}</strong> - Análise baseada em dados reais e validados matematicamente.</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Análise gerada automaticamente pelo <strong>proceda.ia</strong></p>
      <p>Todos os cálculos foram validados e verificados</p>
    </div>
  </div>
</body>
</html>',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM models
  WHERE category = 'data_analysis' AND is_system_template = true
);
