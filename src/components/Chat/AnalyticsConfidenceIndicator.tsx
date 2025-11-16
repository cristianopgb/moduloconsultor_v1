import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface AnalyticsConfidenceIndicatorProps {
  confidence: number;
  metadata?: {
    quality_score?: number;
    policies_applied?: number;
    semantic_coverage?: number;
  };
  compact?: boolean;
}

export function AnalyticsConfidenceIndicator({
  confidence,
  metadata,
  compact = false,
}: AnalyticsConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100);

  const getConfidenceLevel = () => {
    if (percentage >= 80) return { level: 'high', color: 'green', icon: CheckCircle };
    if (percentage >= 60) return { level: 'medium', color: 'yellow', icon: AlertTriangle };
    return { level: 'low', color: 'red', icon: AlertCircle };
  };

  const { level, color, icon: Icon } = getConfidenceLevel();

  const colorClasses = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: 'text-green-600',
      bar: 'bg-green-500',
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: 'text-yellow-600',
      bar: 'bg-yellow-500',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: 'text-red-600',
      bar: 'bg-red-500',
    },
  };

  const colors = colorClasses[color];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200">
        <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
        <span className={`text-xs font-medium ${colors.text}`}>
          {percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <h4 className={`text-sm font-semibold ${colors.text}`}>
              Analysis Confidence
            </h4>
            <span className={`text-lg font-bold ${colors.text}`}>
              {percentage}%
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>
              {level === 'high' && 'High confidence - Results are reliable with strong data quality.'}
              {level === 'medium' && 'Medium confidence - Results are generally reliable but may have limitations.'}
              {level === 'low' && 'Low confidence - Results should be interpreted with caution.'}
            </p>

            {metadata && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-2">
                  {metadata.quality_score !== undefined && (
                    <div>
                      <div className="text-xs font-medium text-gray-500">Data Quality</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {Math.round(metadata.quality_score * 100)}%
                      </div>
                    </div>
                  )}
                  {metadata.policies_applied !== undefined && (
                    <div>
                      <div className="text-xs font-medium text-gray-500">Policies</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {metadata.policies_applied}
                      </div>
                    </div>
                  )}
                  {metadata.semantic_coverage !== undefined && (
                    <div>
                      <div className="text-xs font-medium text-gray-500">Coverage</div>
                      <div className="text-sm font-semibold text-gray-700">
                        {Math.round(metadata.semantic_coverage * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
