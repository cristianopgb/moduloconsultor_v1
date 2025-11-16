import React, { useState } from 'react';
import { GitBranch, Clock, Database, Zap, ChevronDown, ChevronRight, Info } from 'lucide-react';

interface LineageStep {
  step: string;
  timestamp: string;
  duration_ms?: number;
  details?: any;
}

interface LineageViewerProps {
  execId: string;
  steps: LineageStep[];
  metadata?: {
    total_time_ms: number;
    llm_calls: number;
    cost_usd: number;
  };
}

export function LineageViewer({ execId, steps, metadata }: LineageViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (usd: number) => {
    if (usd < 0.01) return `$${(usd * 1000).toFixed(2)}¢`;
    return `$${usd.toFixed(4)}`;
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <GitBranch className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">
            Analysis Lineage
          </span>
          <code className="px-2 py-0.5 text-xs bg-gray-100 rounded font-mono text-gray-600">
            {execId.slice(0, 8)}
          </code>
        </div>

        {metadata && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(metadata.total_time_ms)}
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {metadata.llm_calls} calls
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{formatCost(metadata.cost_usd)}</span>
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`bg-white border rounded-lg transition-all ${
                    selectedStep === index
                      ? 'border-blue-300 shadow-sm'
                      : 'border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => setSelectedStep(selectedStep === index ? null : index)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {step.step}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {step.duration_ms && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(step.duration_ms)}
                        </span>
                      )}
                      {step.details && (
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {selectedStep === index && step.details && (
                    <div className="px-3 pb-3 border-t border-gray-100">
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
              <p className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                All steps are tracked and reproducible with exec_id
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
