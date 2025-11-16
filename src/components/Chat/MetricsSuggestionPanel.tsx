import React, { useState } from 'react';
import { TrendingUp, Plus, Check, HelpCircle, Sparkles } from 'lucide-react';

interface Metric {
  name: string;
  description: string;
  category: 'financial' | 'sales' | 'logistics' | 'hr' | 'generic';
  can_calculate: boolean;
  missing_dependencies?: string[];
  example_value?: string;
}

interface MetricsSuggestionPanelProps {
  suggestedMetrics: Metric[];
  selectedMetrics: string[];
  onSelectMetric: (metricName: string) => void;
  onApplyMetrics?: () => void;
  loading?: boolean;
}

export function MetricsSuggestionPanel({
  suggestedMetrics,
  selectedMetrics,
  onSelectMetric,
  onApplyMetrics,
  loading = false,
}: MetricsSuggestionPanelProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);

  const availableMetrics = suggestedMetrics.filter(m => m.can_calculate);
  const unavailableMetrics = suggestedMetrics.filter(m => !m.can_calculate);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'financial':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'sales':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'logistics':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'hr':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="text-sm">Analyzing available metrics...</span>
        </div>
      </div>
    );
  }

  if (suggestedMetrics.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Suggested Metrics
            </h3>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              {availableMetrics.length} available
            </span>
          </div>

          {selectedMetrics.length > 0 && onApplyMetrics && (
            <button
              onClick={onApplyMetrics}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Calculate ({selectedMetrics.length})
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {availableMetrics.length > 0 && (
          <div className="space-y-2 mb-4">
            {availableMetrics.map((metric) => {
              const isSelected = selectedMetrics.includes(metric.name);
              return (
                <button
                  key={metric.name}
                  onClick={() => onSelectMetric(metric.name)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-700">
                          {metric.name}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getCategoryColor(metric.category)}`}>
                          {metric.category}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 mb-1">
                        {metric.description}
                      </p>

                      {metric.example_value && (
                        <p className="text-xs text-gray-500 font-mono">
                          Example: {metric.example_value}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {unavailableMetrics.length > 0 && (
          <div>
            <button
              onClick={() => setShowUnavailable(!showUnavailable)}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded transition-colors flex items-center justify-between"
            >
              <span>
                {unavailableMetrics.length} metric{unavailableMetrics.length !== 1 ? 's' : ''} unavailable
              </span>
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {showUnavailable && (
              <div className="mt-2 space-y-2">
                {unavailableMetrics.map((metric) => (
                  <div
                    key={metric.name}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            {metric.name}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getCategoryColor(metric.category)}`}>
                            {metric.category}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 mb-2">
                          {metric.description}
                        </p>

                        {metric.missing_dependencies && metric.missing_dependencies.length > 0 && (
                          <div className="text-xs text-red-600">
                            Missing: {metric.missing_dependencies.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {availableMetrics.length === 0 && unavailableMetrics.length > 0 && (
        <div className="px-4 pb-4 text-xs text-gray-500 text-center">
          No metrics can be calculated with the current dataset.
        </div>
      )}
    </div>
  );
}
