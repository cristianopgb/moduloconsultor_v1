// /src/components/Chat/MessageContent.tsx
import React from 'react'
import { Download, Copy, TrendingUp, AlertCircle, CheckCircle, Presentation } from 'lucide-react'
import { ChartRenderer } from '../Datasets/ChartRenderer'
import { supabase } from '../../lib/supabase'
import { uploadHtmlAndOpenPreview } from '../../lib/storagePreview'
import { useAuth } from '../../contexts/AuthContext'
import { AnalysisResultCard } from './AnalysisResultCard'

// ==== Tipos base do seu projeto ====
interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram'
  title: string
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string[]
      borderColor?: string
    }>
  }
  options?: any
}

interface InsightCard {
  title: string
  description: string
  confidence: number
  type: 'trend' | 'correlation' | 'outlier' | 'summary'
}

interface Calculation {
  metric: string
  value: number | string
  formula?: string
  interpretation: string
}

// Alguns backends retornam "metrics" em vez de "calculations"
type MetricAsRecord = Record<string, { value: number | string; label?: string; interpretation?: string }>

// Resposta flexível: aceita vários formatos que vimos no backend
interface AnalysisResponse {
  insights?: Array<InsightCard | string>        // pode vir string[]
  calculations?: Calculation[]                  // caminho 1
  metrics?: MetricAsRecord                      // caminho 2 (será convertido para calculations)
  charts?: Array<ChartConfig | any>             // pode vir sugestão sem "data"
  recommendations?: string[]
  dataQualityNotes?: string[]
  // compat extra: alguns backends guardam tudo em llm_response
  llm_response?: any
  charts_config?: any
}

interface MessageContentProps {
  content: string
  analysisData?: AnalysisResponse | any
  onGenerateDocument?: () => void
  analysisId?: string
  conversationId?: string
  messageType?: 'text' | 'analysis_result' | 'presentation'
}

// ==== Utils de Markdown simples ====
function mdLikeToHtml(input: string) {
  const escapeHtml = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const raw = (input || '').trim()
  const safe = escapeHtml(raw)

  let html = safe.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/^(#{1,6})\s*(.+)$/gm, (_m, h, t) => {
    const level = String(h).length
    return `<div class="mt-3 mb-2 text-[0.95rem] font-semibold">${t}</div>`
  })
  html = html.replace(/^(?:-|\*)\s+(.+)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="space-y-1 list-disc">$1</ul>')
  html = html.replace(/^(?!<div|<ul|<li)(.+)$/gm, '<p class="mb-1">$1</p>')

  return html
}

// ==== Normalizações para suportar múltiplos formatos ====
function normalizeInsights(list: Array<InsightCard | string> | undefined): InsightCard[] {
  if (!Array.isArray(list) || list.length === 0) return []
  return list.map((it) => {
    if (typeof it === 'string') {
      return {
        title: it,
        description: '',
        confidence: 0,
        type: 'summary'
      } as InsightCard
    }
    // garantir campos mínimos
    return {
      title: it.title || 'Insight',
      description: it.description || '',
      confidence: typeof it.confidence === 'number' ? it.confidence : 0,
      type: (it.type as any) || 'summary'
    }
  })
}

function metricsToCalculations(metrics?: MetricAsRecord): Calculation[] {
  if (!metrics || typeof metrics !== 'object') return []
  return Object.entries(metrics).map(([key, m]) => ({
    metric: m?.label || key,
    value: m?.value ?? '',
    interpretation: m?.interpretation || ''
  }))
}

function isConcreteChart(c: any): c is ChartConfig {
  return c && c.data && Array.isArray(c.data.labels) && Array.isArray(c.data.datasets)
}

// Fallback HTML simples quando a Edge Function não devolver HTML
function generateSimplePresentation(data: AnalysisResponse): string {
  const insights = normalizeInsights(data.insights)
  const calcs = Array.isArray(data.calculations) && data.calculations.length
    ? data.calculations
    : metricsToCalculations(data.metrics)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Apresentação de Análise</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1220; color: #e5e7eb; margin: 0; padding: 32px; }
  .container { max-width: 1000px; margin: 0 auto; background:#0f172a; border:1px solid #334155; border-radius:16px; overflow:hidden; }
  .header { padding: 28px 24px; border-bottom:1px solid #334155; background:linear-gradient(180deg, #0b1220 0, #0f172a 100%); }
  h1 { margin:0; font-size:24px; }
  .section { padding: 22px 24px; border-top:1px solid #334155; }
  .section h2 { margin:0 0 10px; color:#93c5fd; font-size:18px; }
  .insight { background:#0b1220; border:1px solid #334155; border-radius:12px; padding:14px; margin:8px 0; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .metric { background:#0b1220; border:1px solid #334155; border-radius:12px; padding:14px; }
  .metric .val { font-size:20px; font-weight:700; }
  .metric .lab { color:#9ca3af; font-size:12px; margin-top:4px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Análise de Dados</h1>
      <div style="color:#9ca3af; font-size:13px; margin-top:6px;">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
    ${insights.length ? `
      <div class="section">
        <h2>Insights</h2>
        ${insights.map(i => `<div class="insight"><div style="font-weight:600">${i.title}</div><div style="color:#cbd5e1; font-size:14px; margin-top:4px">${i.description || ''}</div></div>`).join('')}
      </div>` : ''}
    ${calcs.length ? `
      <div class="section">
        <h2>Métricas</h2>
        <div class="grid">
          ${calcs.map(c => `<div class="metric"><div class="val">${(c.value ?? '').toString()}</div><div class="lab">${c.metric}</div></div>`).join('')}
        </div>
      </div>` : ''}
  </div>
</body>
</html>`
}

// ==== Componente principal ====
export function MessageContent({
  content,
  analysisData,
  onGenerateDocument,
  analysisId,
  conversationId,
  messageType = 'text'
}: MessageContentProps) {
  const { user } = useAuth()
  const [downloadingChart, setDownloadingChart] = React.useState<string | null>(null)
  const [copyingChart, setCopyingChart] = React.useState<string | null>(null)
  const [generatingPresentation, setGeneratingPresentation] = React.useState(false)

  // RENDERIZAÇÃO CONDICIONAL POR TIPO DE MENSAGEM
  if (messageType === 'analysis_result' && analysisId) {
    return <AnalysisResultCard analysisId={analysisId} conversationId={conversationId} />
  }

  if (messageType === 'presentation') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-blue-400">
          <Presentation className="w-5 h-5" />
          <span className="font-medium">Documento gerado</span>
        </div>
        <div
          className="leading-relaxed text-[15px] [&_strong]:text-white/90"
          dangerouslySetInnerHTML={{ __html: mdLikeToHtml(content) }}
        />
      </div>
    )
  }

  // --- DOWNLOAD: procurar o canvas dentro do wrapper data-chart-title (fix) ---
  const downloadChart = async (chart: ChartConfig) => {
    setDownloadingChart(chart.title)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const wrapper = document.querySelector(`[data-chart-title="${CSS.escape(chart.title)}"]`) as HTMLElement | null
      const canvas = wrapper?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) {
        console.warn('[MessageContent] Canvas não encontrado para:', chart.title)
        alert('Gráfico não encontrado. Aguarde a renderização completa.')
        return
      }
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `${chart.title.replace(/\s+/g, '_')}.png`
      a.click()
      console.log('[MessageContent] Gráfico baixado com sucesso:', chart.title)
    } catch (error) {
      console.error('[MessageContent] Erro ao baixar gráfico:', error)
      alert('Erro ao baixar gráfico. Tente novamente.')
    } finally {
      setDownloadingChart(null)
    }
  }

  const copyChartData = async (chart: ChartConfig) => {
    setCopyingChart(chart.title)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API não disponível')
      const data = {
        title: chart.title,
        type: chart.type,
        labels: chart.data.labels,
        datasets: chart.data.datasets.map(ds => ({ label: ds.label, data: ds.data }))
      }
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      console.log('[MessageContent] Dados do gráfico copiados')
    } catch (error) {
      console.error('[MessageContent] Erro ao copiar dados:', error)
      alert('Erro ao copiar dados. Verifique as permissões do navegador.')
    } finally {
      setCopyingChart(null)
    }
  }

  // Unifica formatos: usa analysisData.llm_response se existir
  const mergedData: AnalysisResponse = React.useMemo(() => {
    if (!analysisData) return {}
    if (analysisData.llm_response || analysisData.charts_config) {
      // Alguns backends salvam assim dentro da analysis
      return {
        ...analysisData.llm_response,
        charts: analysisData.llm_response?.charts || analysisData.charts_config || analysisData.charts,
        insights: analysisData.llm_response?.insights || analysisData.insights,
        calculations: analysisData.llm_response?.calculations || analysisData.calculations,
        metrics: analysisData.llm_response?.metrics || analysisData.metrics,
        recommendations: analysisData.llm_response?.recommendations || analysisData.recommendations,
        dataQualityNotes: analysisData.llm_response?.dataQualityNotes || analysisData.dataQualityNotes
      }
    }
    return analysisData
  }, [analysisData])

  const normalizedInsights = normalizeInsights(mergedData.insights)
  const unifiedCalcs: Calculation[] = Array.isArray(mergedData.calculations) && mergedData.calculations.length
    ? mergedData.calculations
    : metricsToCalculations(mergedData.metrics)

  const charts: any[] = Array.isArray(mergedData.charts) ? mergedData.charts : []
  const concreteCharts: ChartConfig[] = charts.filter(isConcreteChart)
  const chartSuggestions: any[] = charts.filter(c => !isConcreteChart(c))

  // ==== Geração de apresentação ====
  const generatePresentation = async () => {
    if (!user?.id) {
      alert('Usuário não autenticado.')
      return
    }
    if (!analysisId && !mergedData) {
      alert('Análise não disponível para gerar apresentação.')
      return
    }

    setGeneratingPresentation(true)
    try {
      console.log('[MessageContent] Gerando apresentação para analysis:', analysisId)
      // pequena espera para feedback visual
      const [, { data, error }] = await Promise.all([
        new Promise(resolve => setTimeout(resolve, 600)),
        analysisId
          ? supabase.functions.invoke('generate-presentation-from-analysis', {
              body: { analysis_id: analysisId, conversation_id: conversationId }
            })
          : Promise.resolve({ data: { success: false, html: null }, error: null })
      ])

      if (error) throw new Error(error.message || 'Erro na Edge Function')

      let finalHtml: string | null = data?.html || null
      if (!finalHtml) {
        // fallback local com o que temos em memória (garante que o botão sempre funcione)
        finalHtml = generateSimplePresentation(mergedData as AnalysisResponse)
      }
      if (!finalHtml) throw new Error('Nenhum HTML foi gerado')

      // Sua função utilitária atual aceita um objeto com metadados (mantido)
      await uploadHtmlAndOpenPreview({
        html: finalHtml,
        title: 'Apresentação de Análise',
        conversationId: conversationId,
        userId: user.id
      })
      console.log('[MessageContent] Apresentação pronta e aberta em nova aba')
    } catch (err: any) {
      console.error('[MessageContent] Erro ao gerar apresentação:', err)
      alert('Erro ao gerar apresentação: ' + (err?.message || 'erro desconhecido'))
    } finally {
      setGeneratingPresentation(false)
    }
  }

  // Sempre usar AnalysisResultCard para análises
  if (messageType === 'analysis_result' && analysisId) {
    return <AnalysisResultCard analysisId={analysisId} />
  }

  return (
    <div className="space-y-4">
      {content && (
        <div
          className="leading-relaxed text-[15px]"
          dangerouslySetInnerHTML={{ __html: mdLikeToHtml(content) }}
        />
      )}

      {normalizedInsights.length > 0 && (
        <div className="space-y-2 mt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <TrendingUp className="w-4 h-4" />
            <span>Insights</span>
          </div>
          {normalizedInsights.map((insight, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-gray-900/50 border border-gray-700"
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="text-white font-medium text-sm">{insight.title}</h4>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    (insight.confidence ?? 0) >= 80
                      ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                      : (insight.confidence ?? 0) >= 60
                      ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
                      : 'bg-gray-800/60 border border-gray-600/50 text-gray-300'
                  }`}
                >
                  {(insight.confidence ?? 0)}%
                </span>
              </div>
              {insight.description && (
                <p className="text-gray-300 text-xs">{insight.description}</p>
              )}
              <span
                className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                  insight.type === 'trend'
                    ? 'bg-blue-900/20 text-blue-400'
                    : insight.type === 'correlation'
                    ? 'bg-purple-900/20 text-purple-400'
                    : insight.type === 'outlier'
                    ? 'bg-red-900/20 text-red-400'
                    : 'bg-gray-900/20 text-gray-400'
                }`}
              >
                {insight.type || 'summary'}
              </span>
            </div>
          ))}
        </div>
      )}

      {unifiedCalcs.length > 0 && (
        <div className="space-y-2 mt-4">
          <div className="text-sm font-semibold text-gray-300">Métricas</div>
          <div className="grid grid-cols-2 gap-2">
            {unifiedCalcs.map((calc, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-gray-900/50 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">{calc.metric}</span>
                  <span className="text-blue-400 font-mono text-sm font-semibold">
                    {calc.value as any}
                  </span>
                </div>
                {calc.interpretation && (
                  <p className="text-gray-500 text-xs">{calc.interpretation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {concreteCharts.length > 0 && (
        <div className="space-y-3 mt-4">
          {concreteCharts.map((chart, idx) => (
            <div key={idx} className="relative">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{chart.title}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => downloadChart(chart)}
                    disabled={downloadingChart === chart.title}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Baixar gráfico"
                  >
                    {downloadingChart === chart.title ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => copyChartData(chart)}
                    disabled={copyingChart === chart.title}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copiar dados"
                  >
                    {copyingChart === chart.title ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              {/* wrapper com data-chart-title para o selector encontrar o canvas interno */}
              <div data-chart-title={chart.title}>
                <ChartRenderer chartConfig={chart} />
              </div>
            </div>
          ))}
        </div>
      )}

      {chartSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <AlertCircle className="w-4 h-4" />
            <span>Sugestões de gráficos</span>
          </div>
          <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
            {chartSuggestions.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{(c?.title) || 'Gráfico'}</span>
                {('x_column' in (c || {}) || 'y_column' in (c || {})) && (
                  <span className="text-gray-400">
                    {' '}— {['x_column','y_column'].map(k => (c as any)[k] ? `${k.replace('_',' ')}: ${(c as any)[k]}` : '').filter(Boolean).join(' | ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mergedData?.recommendations && mergedData.recommendations.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-blue-900/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Recomendações</span>
          </div>
          <ul className="space-y-1">
            {mergedData.recommendations.map((rec: string, idx: number) => (
              <li key={idx} className="text-xs text-blue-200/90 flex items-start gap-2">
                <span className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mergedData?.dataQualityNotes && mergedData.dataQualityNotes.length > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-yellow-900/10 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">Notas de Qualidade</span>
          </div>
          <ul className="space-y-1">
            {mergedData.dataQualityNotes.map((note: string, idx: number) => (
              <li key={idx} className="text-xs text-yellow-200/90">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(normalizedInsights.length > 0 || unifiedCalcs.length > 0) && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <button
            onClick={generatePresentation}
            disabled={generatingPresentation}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Presentation className="w-4 h-4" />
            <span>{generatingPresentation ? 'Gerando…' : 'Gerar Apresentação'}</span>
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Cria automaticamente uma apresentação com os insights e métricas desta análise.
          </p>
        </div>
      )}

      {onGenerateDocument && !analysisId && normalizedInsights.length === 0 && unifiedCalcs.length === 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <button
            onClick={onGenerateDocument}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            Gerar Documento com Estes Insights
          </button>
        </div>
      )}
    </div>
  )
}

export default MessageContent
