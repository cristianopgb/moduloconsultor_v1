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
  chartConfig: ChartConfig
}

export function ChartRenderer({ chartConfig }: ChartRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<any>(null)

  useEffect(() => {
    renderChart()
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [chartConfig])

  const renderChart = async () => {
    if (!canvasRef.current) return

    try {
      // Importar Chart.js dinamicamente
      const { Chart, registerables } = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm')
      Chart.register(...registerables)

      // Destruir gráfico anterior se existir
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
      }

      const ctx = canvasRef.current.getContext('2d')
      if (!ctx) return

      // Configuração padrão baseada no tipo
      const defaultColors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
      ]

      let chartType = chartConfig.type
      if (chartType === 'histogram') chartType = 'bar' // Chart.js não tem histogram nativo

      const config: any = {
        type: chartType,
        data: {
          labels: chartConfig.data.labels,
          datasets: chartConfig.data.datasets.map((dataset, index) => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || 
              (chartConfig.type === 'pie' ? defaultColors : defaultColors[index % defaultColors.length]),
            borderColor: dataset.borderColor || defaultColors[index % defaultColors.length],
            borderWidth: chartConfig.type === 'line' ? 2 : 1,
            fill: chartConfig.type === 'line' ? false : undefined,
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: chartConfig.title,
              color: '#e5e7eb',
              font: { size: 14, weight: 'bold' }
            },
            legend: {
              labels: { color: '#e5e7eb' }
            }
          },
          scales: chartConfig.type !== 'pie' ? {
            x: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' }
            },
            y: {
              ticks: { color: '#9ca3af' },
              grid: { color: '#374151' }
            }
          } : undefined,
          ...chartConfig.options
        }
      }

      chartInstanceRef.current = new Chart(ctx, config)

      // Add data-chart-title attribute for export functionality
      if (canvasRef.current) {
        canvasRef.current.setAttribute('data-chart-title', chartConfig.title)
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

    container.innerHTML = `
      <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h4 class="text-white font-medium mb-3">${chartConfig.title}</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left text-gray-300 p-2">Categoria</th>
                ${chartConfig.data.datasets.map(ds => 
                  `<th class="text-left text-gray-300 p-2">${ds.label}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody>
              ${chartConfig.data.labels.map((label, index) => `
                <tr class="border-b border-gray-800">
                  <td class="text-white p-2">${label}</td>
                  ${chartConfig.data.datasets.map(ds => 
                    `<td class="text-gray-300 p-2">${ds.data[index] || '-'}</td>`
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
    switch (chartConfig.type) {
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
        <h4 className="text-white font-medium">{chartConfig.title}</h4>
        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded capitalize">
          {chartConfig.type}
        </span>
      </div>
      <div className="h-64 relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  )
}