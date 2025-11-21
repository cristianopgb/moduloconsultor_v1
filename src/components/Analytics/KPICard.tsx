import React from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  trend?: string
  comparison?: string
  icon?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function KPICard({
  label,
  value,
  trend,
  comparison,
  icon,
  variant = 'default',
  size = 'md'
}: KPICardProps) {
  // Determine trend direction
  const trendDirection = trend?.includes('+') || trend?.includes('↑')
    ? 'up'
    : trend?.includes('-') || trend?.includes('↓')
      ? 'down'
      : 'neutral'

  // Variant colors
  const variantStyles = {
    default: 'bg-gray-800 border-gray-700',
    success: 'bg-green-900/20 border-green-800',
    warning: 'bg-yellow-900/20 border-yellow-800',
    danger: 'bg-red-900/20 border-red-800'
  }

  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-gray-400'
  }

  // Size styles
  const sizeStyles = {
    sm: {
      container: 'p-3',
      value: 'text-xl',
      label: 'text-xs',
      trend: 'text-xs',
      icon: 'text-lg'
    },
    md: {
      container: 'p-4',
      value: 'text-2xl',
      label: 'text-sm',
      trend: 'text-sm',
      icon: 'text-xl'
    },
    lg: {
      container: 'p-6',
      value: 'text-3xl',
      label: 'text-base',
      trend: 'text-base',
      icon: 'text-2xl'
    }
  }

  const TrendIcon = trendDirection === 'up' ? ArrowUpRight : trendDirection === 'down' ? ArrowDownRight : Minus

  return (
    <div
      className={`
        rounded-lg border transition-all hover:shadow-lg
        ${variantStyles[variant]}
        ${sizeStyles[size].container}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-gray-400 font-medium mb-1 truncate" style={{ fontSize: sizeStyles[size].label }}>
            {label}
          </div>
          <div className="font-bold text-white mb-1 break-words" style={{ fontSize: sizeStyles[size].value }}>
            {value}
          </div>
          {(trend || comparison) && (
            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <div className={`flex items-center gap-1 ${trendColors[trendDirection]}`} style={{ fontSize: sizeStyles[size].trend }}>
                  <TrendIcon className="w-3 h-3" />
                  <span className="font-medium">{trend}</span>
                </div>
              )}
              {comparison && (
                <span className="text-gray-500" style={{ fontSize: sizeStyles[size].trend }}>
                  {comparison}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="text-gray-400 flex-shrink-0" style={{ fontSize: sizeStyles[size].icon }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

interface KPIGridProps {
  kpis: Array<{
    label: string
    value: string
    trend?: string
    comparison?: string
    icon?: string
  }>
  columns?: 2 | 3 | 4
  size?: 'sm' | 'md' | 'lg'
}

export function KPIGrid({ kpis, columns = 3, size = 'md' }: KPIGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {kpis.map((kpi, index) => (
        <KPICard
          key={index}
          label={kpi.label}
          value={kpi.value}
          trend={kpi.trend}
          comparison={kpi.comparison}
          icon={kpi.icon}
          size={size}
        />
      ))}
    </div>
  )
}
