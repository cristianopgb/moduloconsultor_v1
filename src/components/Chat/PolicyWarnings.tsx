import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Warning {
  type: 'quality' | 'semantic' | 'policy' | 'performance' | 'data';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affected_count?: number;
  suggestion?: string;
}

interface PolicyWarningsProps {
  warnings: Warning[];
  policiesApplied?: number;
  onDismiss?: () => void;
  collapsible?: boolean;
}

export function PolicyWarnings({
  warnings,
  policiesApplied,
  onDismiss,
  collapsible = true,
}: PolicyWarningsProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (warnings.length === 0 && !policiesApplied) return null;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
      default:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-600',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: 'text-yellow-600',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          icon: 'text-blue-600',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          icon: 'text-gray-600',
        };
    }
  };

  const errorCount = warnings.filter(w => w.severity === 'error').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;
  const infoCount = warnings.filter(w => w.severity === 'info').length;

  const mainSeverity = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info';
  const mainColors = getSeverityColors(mainSeverity);

  return (
    <div className={`rounded-lg border ${mainColors.border} ${mainColors.bg} overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <div className={mainColors.icon}>
              {getIcon(mainSeverity)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`text-sm font-semibold ${mainColors.text}`}>
                  Analysis Warnings
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  {errorCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                      {errorCount} error{errorCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {warningCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">
                      {warningCount} warning{warningCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {infoCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                      {infoCount} info
                    </span>
                  )}
                </div>
              </div>

              {policiesApplied !== undefined && policiesApplied > 0 && (
                <p className="text-xs text-gray-600 mb-2">
                  <CheckCircle className="w-3 h-3 inline mr-1 text-green-600" />
                  {policiesApplied} automatic {policiesApplied === 1 ? 'policy' : 'policies'} applied
                </p>
              )}

              {!collapsed && (
                <div className="space-y-2 mt-3">
                  {warnings.map((warning, index) => {
                    const colors = getSeverityColors(warning.severity);
                    return (
                      <div
                        key={index}
                        className={`p-2.5 rounded border ${colors.border} bg-white`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`${colors.icon} flex-shrink-0 mt-0.5`}>
                            {getIcon(warning.severity)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${colors.text}`}>
                              {warning.message}
                            </p>
                            {warning.affected_count !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                Affects {warning.affected_count} item{warning.affected_count !== 1 ? 's' : ''}
                              </p>
                            )}
                            {warning.suggestion && (
                              <p className="text-xs text-gray-600 mt-2 italic">
                                💡 {warning.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {collapsible && warnings.length > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                aria-label={collapsed ? 'Expand warnings' : 'Collapse warnings'}
              >
                {collapsed ? (
                  <ChevronDown className={`w-4 h-4 ${mainColors.icon}`} />
                ) : (
                  <ChevronUp className={`w-4 h-4 ${mainColors.icon}`} />
                )}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                aria-label="Dismiss warnings"
              >
                <X className={`w-4 h-4 ${mainColors.icon}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
