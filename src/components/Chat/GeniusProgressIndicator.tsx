import { useState, useEffect } from 'react';
import { ProgressIndicator } from './ProgressIndicator';

interface GeniusProgressIndicatorProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  hasFiles?: boolean;
}

export function GeniusProgressIndicator({
  status,
  createdAt,
  hasFiles = false
}: GeniusProgressIndicatorProps) {
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

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <span>✓</span>
        <span>Tarefa concluída com sucesso</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400">
        <span>✗</span>
        <span>Falha no processamento</span>
      </div>
    );
  }

  const getMessages = () => {
    const base = [
      'Iniciando processamento...',
      'Conectando com Genius AI...',
      'Analisando contexto...',
      'Processando dados...',
      'Gerando insights...',
      'Finalizando análise...'
    ];

    if (hasFiles) {
      return [
        'Iniciando processamento...',
        'Conectando com Genius AI...',
        'Analisando arquivos anexados...',
        'Extraindo informações...',
        'Processando dados complexos...',
        'Gerando insights avançados...',
        'Criando visualizações...',
        'Finalizando documentos...'
      ];
    }

    return base;
  };

  const getCurrentMessage = () => {
    const messages = getMessages();
    const thresholds = hasFiles
      ? [0, 5, 15, 30, 60, 90, 120, 180]
      : [0, 3, 8, 15, 25, 40];

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= thresholds[i]) {
        return messages[i];
      }
    }

    return messages[0];
  };

  return (
    <ProgressIndicator
      messages={[getCurrentMessage()]}
      icon="sparkle"
      size="sm"
      showTimer={elapsedSeconds > 10}
      elapsedSeconds={elapsedSeconds}
    />
  );
}
