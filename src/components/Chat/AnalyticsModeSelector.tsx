import React from 'react';
import { Shield, Zap, Clock } from 'lucide-react';

export type AnalyticsMode = 'governed' | 'quick' | 'legacy';

interface AnalyticsModeSelectorProps {
  mode: AnalyticsMode;
  onChange: (mode: AnalyticsMode) => void;
  disabled?: boolean;
}

export function AnalyticsModeSelector({
  mode,
  onChange,
  disabled = false,
}: AnalyticsModeSelectorProps) {
  const modes = [
    {
      id: 'governed' as AnalyticsMode,
      name: 'Governed',
      icon: Shield,
      description: 'Full governance with semantic layer',
      features: ['Semantic resolution', 'Metrics registry', 'Policy enforcement', 'Complete lineage'],
      cost: '$$',
      speed: 'Medium',
      color: 'blue',
    },
    {
      id: 'quick' as AnalyticsMode,
      name: 'Quick',
      icon: Zap,
      description: 'Fast analysis without extras',
      features: ['Basic analysis', 'Fast results', 'Low cost'],
      cost: '$',
      speed: 'Fast',
      color: 'green',
    },
    {
      id: 'legacy' as AnalyticsMode,
      name: 'Legacy',
      icon: Clock,
      description: 'Original pipeline (backward compatible)',
      features: ['Classic behavior', 'No governance', 'Migration support'],
      cost: '$$',
      speed: 'Slow',
      color: 'gray',
    },
  ];

  const getColorClasses = (color: string, isSelected: boolean) => {
    if (isSelected) {
      switch (color) {
        case 'blue':
          return {
            bg: 'bg-blue-50',
            border: 'border-blue-500',
            text: 'text-blue-700',
            icon: 'text-blue-600',
          };
        case 'green':
          return {
            bg: 'bg-green-50',
            border: 'border-green-500',
            text: 'text-green-700',
            icon: 'text-green-600',
          };
        case 'gray':
          return {
            bg: 'bg-gray-50',
            border: 'border-gray-500',
            text: 'text-gray-700',
            icon: 'text-gray-600',
          };
        default:
          return {
            bg: 'bg-gray-50',
            border: 'border-gray-500',
            text: 'text-gray-700',
            icon: 'text-gray-600',
          };
      }
    }
    return {
      bg: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-600',
      icon: 'text-gray-400',
    };
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">
        Analytics Mode
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((modeConfig) => {
          const isSelected = mode === modeConfig.id;
          const colors = getColorClasses(modeConfig.color, isSelected);
          const Icon = modeConfig.icon;

          return (
            <button
              key={modeConfig.id}
              onClick={() => onChange(modeConfig.id)}
              disabled={disabled}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                colors.bg
              } ${colors.border} ${
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:shadow-md cursor-pointer'
              } ${isSelected ? 'shadow-md' : ''}`}
            >
              <div className="flex items-start gap-2 mb-2">
                <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-semibold ${colors.text}`}>
                      {modeConfig.name}
                    </h4>
                    {isSelected && (
                      <span className="px-1.5 py-0.5 text-xs bg-white rounded font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {modeConfig.description}
                  </p>
                </div>
              </div>

              <div className="space-y-1 mb-2">
                {modeConfig.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className="w-1 h-1 rounded-full bg-gray-400" />
                    {feature}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Cost:</span>
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    {modeConfig.cost}
                  </span>
                </div>
                <div className="w-px h-3 bg-gray-300" />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Speed:</span>
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    {modeConfig.speed}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
