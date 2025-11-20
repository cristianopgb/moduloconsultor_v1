/**
 * ANALYSIS STATE INDICATOR
 *
 * Visual feedback component showing the current state of the analysis conversation.
 * Helps users understand whether the system is collecting context, analyzing, or ready to answer.
 */

import { MessageCircle, FileSearch, Brain, CheckCircle, AlertCircle } from 'lucide-react';

export type AnalysisState =
  | 'idle'
  | 'collecting_context'
  | 'analyzing'
  | 'awaiting_plan_validation'
  | 'ready_to_answer'
  | 'error';

interface AnalysisStateIndicatorProps {
  state: AnalysisState;
  completeness?: number; // 0-100
  message?: string;
  className?: string;
}

export function AnalysisStateIndicator({
  state,
  completeness,
  message,
  className = ''
}: AnalysisStateIndicatorProps) {
  const stateConfig = {
    idle: {
      icon: MessageCircle,
      label: 'Aguardando pergunta',
      color: 'text-gray-400',
      bg: 'bg-gray-800/50',
      description: 'Envie sua pergunta para começar'
    },
    collecting_context: {
      icon: FileSearch,
      label: 'Coletando contexto',
      color: 'text-blue-500',
      bg: 'bg-gray-800/70',
      description: message || 'Enriquecendo a análise com contexto adicional'
    },
    analyzing: {
      icon: Brain,
      label: 'Analisando dados',
      color: 'text-blue-400',
      bg: 'bg-gray-800/70',
      description: message || 'Processando análise completa'
    },
    awaiting_plan_validation: {
      icon: CheckCircle,
      label: 'Aguardando sua aprovação',
      color: 'text-yellow-500',
      bg: 'bg-yellow-900/20',
      description: message || 'Revise o plano de análise abaixo e aprove para continuar'
    },
    ready_to_answer: {
      icon: CheckCircle,
      label: 'Pronto para responder',
      color: 'text-emerald-500',
      bg: 'bg-gray-800/70',
      description: message || 'Análise completa! Faça perguntas sobre os resultados'
    },
    error: {
      icon: AlertCircle,
      label: 'Erro',
      color: 'text-red-400',
      bg: 'bg-gray-800/70',
      description: message || 'Ocorreu um erro. Tente novamente'
    }
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${config.bg} border-gray-700 ${className}`}>
      {/* Icon */}
      <div className={`${config.color}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${config.color}`}>
            {config.label}
          </span>

          {/* Completeness indicator */}
          {state === 'collecting_context' && completeness !== undefined && (
            <span className="text-xs text-gray-400">
              {completeness}%
            </span>
          )}
        </div>

        <p className="text-xs text-gray-300 mt-0.5">
          {config.description}
        </p>

        {/* Simple animated dots for analyzing state */}
        {state === 'analyzing' && (
          <div className="flex space-x-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Pulsing indicator for awaiting validation */}
        {state === 'awaiting_plan_validation' && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-xs text-yellow-400">Aguardando sua ação</span>
          </div>
        )}
      </div>

      {/* Animated dots ONLY for collecting_context state */}
      {state === 'collecting_context' && (
        <div className="flex space-x-1">
          <div className={`w-2 h-2 rounded-full ${config.color} animate-bounce`} style={{ animationDelay: '0ms' }} />
          <div className={`w-2 h-2 rounded-full ${config.color} animate-bounce`} style={{ animationDelay: '150ms' }} />
          <div className={`w-2 h-2 rounded-full ${config.color} animate-bounce`} style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
