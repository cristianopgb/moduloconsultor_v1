export async function chartToBase64Image(canvas: HTMLCanvasElement): Promise<string> {
  try {
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Erro ao converter gráfico para imagem:', error)
    throw error
  }
}

export async function downloadChartAsImage(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  try {
    const url = await chartToBase64Image(canvas)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (error) {
    console.error('Erro ao baixar gráfico:', error)
    throw error
  }
}

export interface ChartConfig {
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

export async function createChartCanvas(config: ChartConfig): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível criar contexto 2D')

  const { Chart, registerables } = await import('chart.js')
  Chart.register(...registerables)

  const defaultColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ]

  let chartType = config.type
  if (chartType === 'histogram') chartType = 'bar'

  new Chart(ctx, {
    type: chartType as any,
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
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: config.title,
          color: '#ffffff',
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          labels: { color: '#ffffff' }
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
  })

  await new Promise(resolve => setTimeout(resolve, 100))

  return canvas
}

export async function convertChartToBase64(config: ChartConfig): Promise<string> {
  const canvas = await createChartCanvas(config)
  const base64 = await chartToBase64Image(canvas)
  return base64
}

export async function injectChartsIntoHTML(
  html: string,
  charts: ChartConfig[]
): Promise<string> {
  let modifiedHtml = html

  for (let i = 0; i < charts.length; i++) {
    const placeholder = `{{grafico_${i + 1}}}`
    const placeholderAlt = `{{chart_${i + 1}}}`

    if (modifiedHtml.includes(placeholder) || modifiedHtml.includes(placeholderAlt)) {
      try {
        const base64 = await convertChartToBase64(charts[i])
        const imgTag = `<img src="${base64}" alt="${charts[i].title}" style="max-width: 100%; height: auto;" />`

        modifiedHtml = modifiedHtml
          .replace(new RegExp(placeholder, 'g'), imgTag)
          .replace(new RegExp(placeholderAlt, 'g'), imgTag)
      } catch (error) {
        console.error(`Erro ao injetar gráfico ${i + 1}:`, error)
      }
    }
  }

  const genericPlaceholder = /\{\{grafico(?:_\w+)?\}\}/g
  modifiedHtml = modifiedHtml.replace(genericPlaceholder, '')

  return modifiedHtml
}
