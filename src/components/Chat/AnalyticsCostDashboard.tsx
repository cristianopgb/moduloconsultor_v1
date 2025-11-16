import React from 'react';
import { DollarSign, Zap, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface CostMetrics {
  total_cost_usd: number;
  total_queries: number;
  total_tokens: number;
  avg_cost_per_query: number;
  llm_calls: number;
  execution_time_ms: number;
  cache_hit_rate?: number;
}

interface AnalyticsCostDashboardProps {
  metrics: CostMetrics;
  trend?: {
    cost_change_percent: number;
    queries_change_percent: number;
  };
  compact?: boolean;
}

export function AnalyticsCostDashboard({
  metrics,
  trend,
  compact = false,
}: AnalyticsCostDashboardProps) {
  const formatCost = (usd: number) => {
    if (usd < 0.01) return `${(usd * 1000).toFixed(2)}¢`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-semibold text-gray-700">
            {formatCost(metrics.total_cost_usd)}
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs text-gray-600">
            {metrics.llm_calls} calls
          </span>
        </div>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-xs text-gray-600">
            {formatTime(metrics.execution_time_ms)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Analytics Cost & Performance
          </h3>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Total Cost</span>
              {trend && trend.cost_change_percent !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs ${
                  trend.cost_change_percent > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {trend.cost_change_percent > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(trend.cost_change_percent).toFixed(0)}%
                </div>
              )}
            </div>
            <div className="text-xl font-bold text-green-700">
              {formatCost(metrics.total_cost_usd)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatCost(metrics.avg_cost_per_query)}/query avg
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Queries</span>
              {trend && trend.queries_change_percent !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs ${
                  trend.queries_change_percent > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend.queries_change_percent > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(trend.queries_change_percent).toFixed(0)}%
                </div>
              )}
            </div>
            <div className="text-xl font-bold text-blue-700">
              {formatNumber(metrics.total_queries)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {metrics.llm_calls} LLM calls
            </div>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="text-xs text-gray-600 block mb-1">Tokens Used</span>
            <div className="text-xl font-bold text-purple-700">
              {formatNumber(metrics.total_tokens)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatNumber(Math.round(metrics.total_tokens / Math.max(metrics.llm_calls, 1)))}/call
            </div>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <span className="text-xs text-gray-600 block mb-1">Execution Time</span>
            <div className="text-xl font-bold text-orange-700">
              {formatTime(metrics.execution_time_ms)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatTime(Math.round(metrics.execution_time_ms / Math.max(metrics.total_queries, 1)))}/query
            </div>
          </div>
        </div>

        {metrics.cache_hit_rate !== undefined && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Cache Efficiency</span>
              <span className="text-xs font-semibold text-gray-700">
                {(metrics.cache_hit_rate * 100).toFixed(0)}% hit rate
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics.cache_hit_rate * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Higher cache hit rate means lower costs and faster responses
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">Cost per 1K tokens</span>
            <span className="font-semibold text-gray-700">
              {formatCost((metrics.total_cost_usd / metrics.total_tokens) * 1000)}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">Tokens per second</span>
            <span className="font-semibold text-gray-700">
              {formatNumber(Math.round((metrics.total_tokens / metrics.execution_time_ms) * 1000))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
