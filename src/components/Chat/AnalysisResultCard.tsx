import React, { useEffect, useState } from 'react'
import { BarChart3, Table, TrendingUp, Info, Loader2, AlertCircle, CheckCircle, Lightbulb, Target, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ChartRenderer } from '../Datasets/ChartRenderer'
import { KPIGrid } from '../Analytics/KPICard'
import { uploadHtmlAndOpenPreview } from '../../lib/storagePreview'
import { useAuth } from '../../contexts/AuthContext'

interface AnalysisData {
  id: string
  user_question: string
  executive_headline?: string
  executive_summary_text?: string
  llm_reasoning?: string
  generated_sql?: string
  query_results: any[]
  ai_response: {
    headline?: string
    executive_summary?: string
    kpi_cards?: Array<{
      label: string
      value: string
      trend?: string
      comparison?: string
      icon?: string
    }>
    key_insights?: Array<{
      title: string
      description: string
      numbers?: string[]
      importance?: 'high' | 'medium' | 'low'
      emoji?: string
    }>
    insights?: string[]
    summary?: string
    visualizations?: Array<{
      type: 'bar' | 'line' | 'pie' | 'table' | 'scatter'
      title: string
      data: any
      interpretation?: string
      insights?: string[]
    }>
    charts?: Array<{
      type: 'bar' | 'line' | 'pie'
      title: string
      data: any
    }>
    business_recommendations?: Array<{
      action: string
      rationale: string
      expected_impact: string
      priority?: 'high' | 'medium' | 'low'
    }>
    next_questions?: string[]
  }
  business_recommendations?: any[]
  next_questions?: string[]
  full_dataset_rows: number
  status: string
  error_message?: string
  created_at: string
}

interface AnalysisResultCardProps {
  analysisId: string
}

export function AnalysisResultCard({ analysisId }: AnalysisResultCardProps) {
  const { user } = useAuth()
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [generatingDoc, setGeneratingDoc] = useState(false)

  useEffect(() => {
    loadAnalysis()
  }, [analysisId])

  const loadAnalysis = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Carregar análise principal
      const { data: analysisData, error: fetchError } = await supabase
        .from('data_analyses')
        .select('*')
        .eq('id', analysisId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!analysisData) throw new Error('Análise não encontrada')

      // 2. Carregar KPIs separadamente
      const { data: kpis } = await supabase
        .from('analysis_kpis')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('position', { ascending: true })

      // 3. Carregar Visualizações separadamente
      const { data: vizs } = await supabase
        .from('analysis_visualizations')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('position', { ascending: true })

      // 4. Reconstruir ai_response com dados completos
      // Filter invalid KPIs before rendering
      const rawKpis = kpis?.map(k => ({
        label: k.kpi_label,
        value: k.kpi_value,
        trend: k.trend,
        comparison: k.comparison,
        icon: k.icon_name
      })) || (analysisData.ai_response?.kpi_cards || [])

      const validKpis = rawKpis.filter(kpi =>
        kpi.value &&
        kpi.value !== 'N/A' &&
        kpi.value !== 'undefined' &&
        kpi.value !== 'null' &&
        String(kpi.value).trim() !== ''
      )

      const reconstructedResponse = {
        ...(analysisData.ai_response || {}),
        kpi_cards: validKpis,
        visualizations: vizs?.map(v => ({
          type: v.viz_type,
          title: v.title,
          data: v.data,
          interpretation: v.interpretation,
          insights: v.insights
        })) || (analysisData.ai_response?.visualizations || analysisData.ai_response?.charts || [])
      }

      setAnalysis({
        ...analysisData,
        ai_response: reconstructedResponse
      } as AnalysisData)
    } catch (err: any) {
      console.error('Erro ao carregar análise:', err)
      setError(err.message || 'Erro ao carregar análise')
    } finally {
      setLoading(false)
    }
  }

  const generateAnalysisHTML = (data: AnalysisData): string => {
    const aiResponse = data.ai_response || {}
    const headline = data.executive_headline || aiResponse.headline || 'Análise de Dados'
    const executiveSummary = data.executive_summary_text || aiResponse.executive_summary || aiResponse.summary || ''

    // Filter invalid KPIs before rendering document
    const rawKpiCards = aiResponse.kpi_cards || []
    const kpiCards = rawKpiCards.filter(kpi =>
      kpi.value &&
      kpi.value !== 'N/A' &&
      kpi.value !== 'undefined' &&
      kpi.value !== 'null' &&
      String(kpi.value).trim() !== ''
    )

    const keyInsights = aiResponse.key_insights || []
    const visualizations = aiResponse.visualizations || aiResponse.charts || []
    const businessRecs = data.business_recommendations || aiResponse.business_recommendations || []
    const nextQuestions = data.next_questions || aiResponse.next_questions || []

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
      padding: 40px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      padding: 48px 40px;
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .header p {
      font-size: 18px;
      opacity: 0.95;
      line-height: 1.7;
    }
    .content {
      padding: 40px;
    }
    section {
      margin-bottom: 48px;
    }
    h2 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #111827;
      border-left: 4px solid #3b82f6;
      padding-left: 16px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      padding: 24px;
      border-radius: 10px;
      border-left: 4px solid #3b82f6;
    }
    .kpi-card h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .kpi-meta {
      font-size: 13px;
      color: #059669;
      font-weight: 500;
    }
    .insight-card {
      background: #fefce8;
      border-left: 4px solid #eab308;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .insight-card.high {
      background: #fef2f2;
      border-left-color: #ef4444;
    }
    .insight-card h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #111827;
    }
    .insight-card p {
      color: #374151;
      margin-bottom: 12px;
    }
    .insight-numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    .insight-numbers span {
      background: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #1f2937;
    }
    .rec-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #f59e0b;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .rec-card h3 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #111827;
    }
    .rec-card p {
      color: #374151;
      margin-bottom: 8px;
    }
    .impact-box {
      background: #dcfce7;
      padding: 12px;
      border-radius: 6px;
      margin-top: 12px;
      font-size: 14px;
      color: #166534;
    }
    .impact-box strong {
      font-weight: 700;
    }
    .viz-section {
      background: #f9fafb;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .viz-section h3 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #111827;
    }
    .viz-placeholder {
      background: white;
      border: 2px dashed #d1d5db;
      padding: 40px;
      border-radius: 8px;
      text-align: center;
      color: #6b7280;
      margin-bottom: 12px;
    }
    .viz-interpretation {
      font-size: 14px;
      color: #6b7280;
      font-style: italic;
      margin-top: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
      color: #111827;
    }
    tr:hover {
      background: #f9fafb;
    }
    .next-questions {
      background: #eff6ff;
      padding: 24px;
      border-radius: 8px;
      border: 2px solid #bfdbfe;
    }
    .next-questions h2 {
      border-left-color: #3b82f6;
      margin-bottom: 16px;
    }
    .next-questions ul {
      list-style: none;
    }
    .next-questions li {
      padding: 10px 0;
      color: #1e40af;
      font-weight: 500;
    }
    .next-questions li:before {
      content: "❓ ";
      margin-right: 8px;
    }
    .footer {
      background: #f3f4f6;
      padding: 24px 40px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .__selectable {
      cursor: text;
    }
    .__selectable:hover {
      outline: 2px dashed rgba(59, 130, 246, 0.3);
      outline-offset: 4px;
    }
    @media print {
      body { padding: 0; background: white; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="__selectable">${headline}</h1>
      ${executiveSummary ? `<p class="__selectable">${executiveSummary}</p>` : ''}
    </div>

    <div class="content">
      ${kpiCards.length > 0 ? `
      <section>
        <h2>📊 Métricas Principais</h2>
        <div class="kpi-grid">
          ${kpiCards.map(kpi => `
            <div class="kpi-card">
              <h3>${kpi.label}</h3>
              <div class="kpi-value __selectable">${kpi.value}</div>
              ${kpi.trend || kpi.comparison ? `<div class="kpi-meta">${kpi.trend || ''} ${kpi.comparison || ''}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </section>
      ` : ''}

      ${keyInsights.length > 0 ? `
      <section>
        <h2>💡 Principais Descobertas</h2>
        ${keyInsights.map(insight => `
          <div class="insight-card ${insight.importance === 'high' ? 'high' : ''}">
            <h3>${insight.emoji || '📌'} ${insight.title}</h3>
            <p class="__selectable">${insight.description}</p>
            ${insight.numbers && insight.numbers.length > 0 ? `
              <div class="insight-numbers">
                ${insight.numbers.map(num => `<span class="__selectable">${num}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>
      ` : ''}

      ${visualizations.length > 0 ? `
      <section>
        <h2>📈 Visualizações</h2>
        ${visualizations.map((viz, index) => {
          if (viz.type === 'table' || !viz.data || !viz.data.labels || !viz.data.datasets) {
            // Fallback para tabela se não for gráfico
            return `
              <div class="viz-section">
                <h3>${viz.title || 'Dados'}</h3>
                <div class="viz-placeholder">
                  <p>Tabela de dados</p>
                  <p style="font-size: 12px; margin-top: 8px;">${viz.interpretation || ''}</p>
                </div>
              </div>
            `
          }

          // Renderizar gráfico real com Chart.js
          return `
            <div class="viz-section">
              <h3>${viz.title || 'Gráfico'}</h3>
              <div style="position: relative; height: 400px; margin: 20px 0;">
                <canvas id="chart-${index}"></canvas>
              </div>
              ${viz.interpretation ? `<p class="viz-interpretation __selectable">${viz.interpretation}</p>` : ''}
              ${viz.insights && viz.insights.length > 0 ? `
                <ul style="margin-top: 12px; padding-left: 20px;">
                  ${viz.insights.map(insight => `<li class="__selectable" style="margin-bottom: 6px;">${insight}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `
        }).join('')}
      </section>
      ` : ''}

      ${businessRecs.length > 0 ? `
      <section>
        <h2>🎯 Recomendações</h2>
        ${businessRecs.map(rec => `
          <div class="rec-card">
            <h3>${rec.action}</h3>
            <p class="__selectable">${rec.rationale}</p>
            ${rec.expected_impact ? `
              <div class="impact-box">
                <strong>Impacto Esperado:</strong> <span class="__selectable">${rec.expected_impact}</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </section>
      ` : ''}

      ${data.query_results && data.query_results.length > 0 ? `
      <section>
        <h2>📋 Dados Analisados</h2>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                ${Object.keys(data.query_results[0]).map(key => `<th>${key}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.query_results.slice(0, 20).map(row => `
                <tr>
                  ${Object.values(row).map((val: any) => `
                    <td class="__selectable">${typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val || '-')}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${data.query_results.length > 20 ? `<p style="text-align: center; color: #6b7280; font-size: 14px;">Mostrando 20 de ${data.query_results.length} resultados</p>` : ''}
        </div>
      </section>
      ` : ''}

      ${nextQuestions.length > 0 ? `
      <div class="next-questions">
        <h2>🔍 Próximas Perguntas Sugeridas</h2>
        <ul>
          ${nextQuestions.map(q => `<li>${q}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às ${new Date().toLocaleTimeString('pt-BR')}</p>
      <p style="margin-top: 8px;">Total de registros analisados: ${data.full_dataset_rows.toLocaleString('pt-BR')}</p>
    </div>
  </div>

  <script>
    // Initialize all Chart.js visualizations
    ${visualizations.map((viz, index) => {
      if (viz.type === 'table' || !viz.data || !viz.data.labels || !viz.data.datasets) {
        return ''
      }

      const chartType = viz.type === 'histogram' ? 'bar' : viz.type
      const defaultColors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
      ]

      return `
        (function() {
          try {
            const ctx = document.getElementById('chart-${index}');
            if (!ctx) return;

            new Chart(ctx, {
              type: '${chartType}',
              data: {
                labels: ${JSON.stringify(viz.data.labels)},
                datasets: ${JSON.stringify(viz.data.datasets.map((ds, idx) => ({
                  ...ds,
                  backgroundColor: ds.backgroundColor || (viz.type === 'pie' ? defaultColors : defaultColors[idx % defaultColors.length]),
                  borderColor: ds.borderColor || defaultColors[idx % defaultColors.length],
                  borderWidth: viz.type === 'line' ? 2 : 1,
                  fill: viz.type === 'line' ? false : undefined
                })))}
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: {
                    display: true,
                    text: '${viz.title || 'Gráfico'}',
                    font: { size: 16, weight: 'bold' }
                  },
                  legend: {
                    display: true,
                    position: 'bottom'
                  }
                },
                scales: ${viz.type !== 'pie' ? `{
                  x: { ticks: { maxRotation: 45, minRotation: 0 } },
                  y: { beginAtZero: true }
                }` : 'undefined'}
              }
            });
          } catch (err) {
            console.error('Failed to render chart ${index}:', err);
          }
        })();
      `
    }).join('\n')}
  </script>
</body>
</html>`
  }

  const handleGenerateDocument = async () => {
    if (!analysis) return

    setGeneratingDoc(true)
    try {
      const html = generateAnalysisHTML(analysis)

      await uploadHtmlAndOpenPreview({
        html,
        title: analysis.executive_headline || analysis.ai_response?.headline || 'Análise de Dados',
        userId: user?.id,
        conversationId: null,
        persistToStorage: true
      })
    } catch (error: any) {
      console.error('Erro ao gerar documento:', error)
      alert('Erro ao gerar documento: ' + (error?.message || 'erro desconhecido'))
    } finally {
      setGeneratingDoc(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Carregando análise...</span>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-900/20 rounded-lg border border-red-800">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-sm text-red-400">{error || 'Análise não encontrada'}</span>
      </div>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-red-400">Análise Falhou</h3>
        </div>
        <p className="text-sm text-gray-400 mb-2">{analysis.user_question}</p>
        {analysis.error_message && (
          <p className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{analysis.error_message}</p>
        )}
      </div>
    )
  }

  const aiResponse = analysis.ai_response || {}
  const headline = analysis.executive_headline || aiResponse.headline
  const executiveSummary = analysis.executive_summary_text || aiResponse.executive_summary || aiResponse.summary || ''
  const kpiCards = aiResponse.kpi_cards || []
  const keyInsights = aiResponse.key_insights || []
  const insights = aiResponse.insights || []
  const visualizations = aiResponse.visualizations || aiResponse.charts || []
  const businessRecommendations = analysis.business_recommendations || aiResponse.business_recommendations || []
  const nextQuestions = analysis.next_questions || aiResponse.next_questions || []

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Análise de Dados</h3>
            </div>
            <p className="text-sm text-gray-300">{analysis.user_question}</p>
            <p className="text-xs text-gray-500 mt-1">
              {analysis.full_dataset_rows.toLocaleString()} linhas analisadas
            </p>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Info className="w-4 h-4" />
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Headline Section */}
        {headline && (
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <h2 className="text-xl font-bold text-white">{headline}</h2>
          </div>
        )}

        {/* Executive Summary */}
        {executiveSummary && (
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h4 className="text-base font-semibold text-white">Resumo Executivo</h4>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{executiveSummary}</p>
          </div>
        )}

        {/* KPI Cards Grid */}
        {kpiCards.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Métricas Principais
            </h4>
            <KPIGrid kpis={kpiCards} columns={kpiCards.length <= 2 ? 2 : 3} size="md" />
          </div>
        )}

        {/* Key Insights (enhanced) */}
        {keyInsights.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Principais Descobertas
            </h4>
            {keyInsights.map((insight: any, idx: number) => (
              <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border-l-4 border-blue-500">
                <div className="flex items-start gap-2 mb-2">
                  {insight.emoji && <span className="text-xl">{insight.emoji}</span>}
                  <h5 className="font-semibold text-white flex-1">{insight.title}</h5>
                  {insight.importance === 'high' && (
                    <span className="px-2 py-0.5 bg-red-900/30 text-red-400 text-xs rounded">Alta</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                {insight.numbers && insight.numbers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {insight.numbers.map((num: string, numIdx: number) => (
                      <span key={numIdx} className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded">
                        {num}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legacy insights (simple list) */}
        {insights.length > 0 && keyInsights.length === 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Insights
            </h4>
            <ul className="space-y-1">
              {insights.map((insight: any, idx: number) => {
                const insightText = typeof insight === 'string'
                  ? insight
                  : insight?.content || insight?.description || insight?.title || JSON.stringify(insight)
                return (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{insightText}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Visualizations */}
        {visualizations.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Visualizações
            </h4>
            {visualizations.map((viz: any, idx: number) => {
              if (!viz || !viz.type || !viz.data) return null
              return (
                <div key={idx} className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                  <h5 className="text-sm font-medium text-white">{viz.title || 'Gráfico'}</h5>
                  {viz.type !== 'table' ? (
                    <ChartRenderer
                      type={viz.type}
                      data={viz.data}
                      title={viz.title || 'Gráfico'}
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-700">
                            {viz.data.columns?.map((col: string, colIdx: number) => (
                              <th key={colIdx} className="text-left p-2 text-gray-400 font-medium">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {viz.data.rows?.slice(0, 10).map((row: any[], rowIdx: number) => (
                            <tr key={rowIdx} className="border-b border-gray-800">
                              {row.map((cell: any, cellIdx: number) => (
                                <td key={cellIdx} className="p-2 text-gray-300">
                                  {typeof cell === 'number' ? cell.toLocaleString() : String(cell || '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {viz.interpretation && (
                    <p className="text-xs text-gray-400 italic">{viz.interpretation}</p>
                  )}
                  {viz.insights && viz.insights.length > 0 && (
                    <ul className="text-xs text-gray-400 space-y-1">
                      {viz.insights.map((insight: string, insightIdx: number) => (
                        <li key={insightIdx} className="flex items-start gap-1">
                          <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Business Recommendations */}
        {businessRecommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Recomendações
            </h4>
            {businessRecommendations.map((rec: any, idx: number) => (
              <div key={idx} className="bg-gradient-to-r from-orange-900/20 to-gray-900/50 rounded-lg p-4 border-l-4 border-orange-500">
                <div className="flex items-start gap-2 mb-2">
                  <h5 className="font-semibold text-white flex-1">{rec.action}</h5>
                  {rec.priority === 'high' && (
                    <span className="px-2 py-0.5 bg-orange-900/50 text-orange-300 text-xs rounded">Prioridade Alta</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 mb-2">{rec.rationale}</p>
                {rec.expected_impact && (
                  <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded">
                    <strong>Impacto Esperado:</strong> {rec.expected_impact}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Next Questions */}
        {nextQuestions.length > 0 && (
          <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-800/30">
            <h4 className="text-sm font-semibold text-white mb-2">Próximas Perguntas Sugeridas</h4>
            <ul className="space-y-1">
              {nextQuestions.map((q: string, idx: number) => (
                <li key={idx} className="text-xs text-blue-300 flex items-start gap-2">
                  <span className="text-blue-400">❓</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.query_results && analysis.query_results.length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Table className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-medium text-white">Dados</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    {Object.keys(analysis.query_results[0]).map((key) => (
                      <th key={key} className="text-left p-2 text-gray-400 font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.query_results.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800">
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td key={cellIdx} className="p-2 text-gray-300">
                          {typeof value === 'number' ? value.toLocaleString() : String(value || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {analysis.query_results.length > 10 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Mostrando 10 de {analysis.query_results.length} resultados
                </p>
              )}
            </div>
          </div>
        )}

        {showDetails && (
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-3">
            {analysis.llm_reasoning && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-1">Raciocínio da IA</h5>
                <p className="text-xs text-gray-500">{analysis.llm_reasoning}</p>
              </div>
            )}
            {analysis.generated_sql && (
              <div>
                <h5 className="text-xs font-medium text-gray-400 mb-1">SQL Executado</h5>
                <pre className="text-xs text-gray-500 bg-black/30 p-2 rounded overflow-x-auto">
                  {analysis.generated_sql}
                </pre>
              </div>
            )}
            <div className="text-xs text-gray-500">
              Criado em: {new Date(analysis.created_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Botão Gerar Documento - Ao Final da Análise */}
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <button
            onClick={handleGenerateDocument}
            disabled={generatingDoc}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {generatingDoc ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Gerando Documento...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Exportar Análise Completa</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Gere um documento HTML editável com toda a análise, gráficos e métricas
          </p>
        </div>
      </div>
    </div>
  )
}
