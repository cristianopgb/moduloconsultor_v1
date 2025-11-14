import React, { useState, useEffect } from 'react';
import { Loader2, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface TaskProgressIndicatorProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  estimatedTimeSeconds?: number;
}

export function TaskProgressIndicator({
  status,
  createdAt,
  estimatedTimeSeconds = 120
}: TaskProgressIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status === 'pending' || status === 'running') {
      const interval = setInterval(() => {
        const now = Date.now();
        const created = new Date(createdAt).getTime();
        const elapsed = Math.floor((now - created) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, createdAt]);

  const getProgressMessage = () => {
    if (status === 'completed') return 'Tarefa concluída com sucesso';
    if (status === 'failed') return 'Falha no processamento';

    if (elapsedSeconds < 10) return 'Iniciando processamento...';
    if (elapsedSeconds < 30) return 'Analisando conteúdo...';
    if (elapsedSeconds < 60) return 'Gerando insights...';
    if (elapsedSeconds < 90) return 'Criando visualizações...';
    if (elapsedSeconds < 120) return 'Finalizando documento...';
    return 'Processamento avançado em andamento...';
  };

  const getProgressPercentage = () => {
    if (status === 'completed') return 100;
    if (status === 'failed') return 0;

    const percentage = Math.min(95, (elapsedSeconds / estimatedTimeSeconds) * 100);
    return Math.round(percentage);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
    }
  };

  if (status === 'completed' || status === 'failed') {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getProgressMessage()}</span>
      </div>
    );
  }

  const progress = getProgressPercentage();

  return (
    <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-gray-200">
            {getProgressMessage()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      <div className="relative">
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-500 ease-out relative`}
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
        <div className="absolute -top-1 right-0 flex items-center gap-1 text-xs text-gray-400">
          <Zap className="w-3 h-3" />
          <span>{progress}%</span>
        </div>
      </div>

      {estimatedTimeSeconds && elapsedSeconds < estimatedTimeSeconds && (
        <p className="text-xs text-gray-500 text-center">
          Tempo estimado restante: ~{formatTime(estimatedTimeSeconds - elapsedSeconds)}
        </p>
      )}

      {elapsedSeconds > estimatedTimeSeconds && (
        <p className="text-xs text-yellow-400 text-center flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Processamento mais demorado que o esperado, mas ainda em andamento...
        </p>
      )}
    </div>
  );
}
