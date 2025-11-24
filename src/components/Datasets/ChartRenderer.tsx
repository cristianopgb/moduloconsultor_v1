import React, { useEffect, useRef } from 'react'
import { BarChart3, PieChart, TrendingUp, Activity } from 'lucide-react'

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

interface ChartRendererProps {
  chartConfig?: ChartConfig
  type?: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram'
  data?: any
  title?: string
}

export function ChartRenderer({ chartConfig, type, data, title }: ChartRendererProps) {
  const config = chartConfig || (type && data ? {
    type,
    title: title || 'Gráfico',
    data
  } : null)

  // Validação defensiva: garantir que config tem estrutura mínima
  if (!config || !config.data || !config.data.datasets || config.data.datasets.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <p className="text-sm text-gray-400">Configuração de gráfico inválida</p>
      </div>
    )
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (config) {
      renderChart()
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [config])

  const renderChart = async () => {
    if (!canvasRef.current || !config) return

    try {
      // Importar Chart.js dinamicamente
      const { Chart, registerables } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm')
      Chart.register(...registerables)

      // Destruir gráfico anterior se existir
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
      }

      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return

      // Configuração padrão baseada no tipo
      const defaultColors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
      ]

      let chartType = config.type
      if (chartType === 'histogram') chartType = 'bar'

      const chartJsConfig: any = {
        type: chartType,
        data: {
          labels: config.data.labels,
          datasets: config.data.datasets.map((dataset, index) => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor ||
              (config.type === 'pie' ? defaultColors : defaultColors[index % defaultColors.length]),
            borderColor: dataset.borderColor || defaultColors[index % defaultColors.length],
            borderWidth: config.type === 'line' ? 2 : 1,
            fill: config.type === 'line' ? false : undefined,
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: config.title,
              color: '#e5e7eb',
              font: { size: 14, weight: 'bold' }
            },
            legend: {
              labels: { color: '#e5e7eb' }
            }
          },
          scales: config.type !== 'pie' ? {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' }
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' }
            }
          } : undefined,
          ...config.options
        }
      }

      chartInstanceRef.current = new Chart(ctx, chartJsConfig)

      // Add data-chart-title attribute for export functionality
      if (canvasRef.current) {
        canvasRef.current.setAttribute('data-chart-title', config?.title || 'Gráfico')
      }

    } catch (error) {
      console.error('[DEBUG] Erro ao renderizar gráfico:', error)
      // Fallback: mostrar dados em tabela
      renderFallbackTable()
    }
  }

  const renderFallbackTable = () => {
    if (!canvasRef.current) return
    
    const container = canvasRef.current.parentElement
    if (!container) return

    // Validação defensiva para fallback
    const safeTitle = config?.title || 'Dados'
    const safeLabels = config?.data?.labels || []
    const safeDatasets = config?.data?.datasets || []

    container.innerHTML = `
      <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 class="text-white font-medium mb-3">${safeTitle}</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left text-gray-300 p-2">Categoria</th>
                ${safeDatasets.map(ds =>
                  `<th class="text-left text-gray-300 p-2">${ds.label || 'Dados'}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${safeLabels.map((label, index) => `
                <tr class="border-b border-gray-800">
                  <td class="text-white p-2">${label}</td>
                  ${safeDatasets.map(ds =>
                    `<td class="text-gray-300 p-2">${ds.data?.[index] || '-'}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  const getChartIcon = () => {
    switch (config?.type) {
      case 'bar': return <BarChart3 className="w-4 h-4" />
      case 'pie': return <PieChart className="w-4 h-4" />
      case 'line': return <TrendingUp className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        {getChartIcon()}
        <h4 className="text-white font-medium">{config?.title || 'Gráfico'}</h4>
        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded capitalize">
          {config?.type || 'bar'}
        </span>
      </div>
      <div className="h-64 relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}