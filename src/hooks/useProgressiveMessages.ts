import { useState, useEffect } from 'react';

interface ProgressiveMessagesConfig {
  type: 'time-based' | 'event-based';
  messages: string[] | { threshold: number; message: string }[];
  interval?: number;
}

export function useProgressiveMessages(config: ProgressiveMessagesConfig) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (config.type === 'time-based' && Array.isArray(config.messages)) {
      const messages = config.messages as { threshold: number; message: string }[];

      const timer = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newElapsed = prev + 1;

          const applicableMessage = messages
            .filter((m) => newElapsed >= m.threshold)
            .sort((a, b) => b.threshold - a.threshold)[0];

          if (applicableMessage) {
            setCurrentMessage(applicableMessage.message);
          }

          return newElapsed;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [config.type, config.messages]);

  return { currentMessage, elapsedSeconds };
}

export const MESSAGE_PRESETS = {
  analytics: [
    { threshold: 0, message: 'Analisando dados...' },
    { threshold: 5, message: 'Processando informações...' },
    { threshold: 15, message: 'Gerando insights...' },
    { threshold: 30, message: 'Criando visualizações...' },
    { threshold: 60, message: 'Finalizando análise...' }
  ],
  genius: [
    { threshold: 0, message: 'Iniciando processamento...' },
    { threshold: 5, message: 'Conectando com Genius AI...' },
    { threshold: 15, message: 'Analisando arquivos e contexto...' },
    { threshold: 30, message: 'Processando dados...' },
    { threshold: 60, message: 'Gerando insights e análises...' },
    { threshold: 90, message: 'Criando visualizações...' },
    { threshold: 120, message: 'Finalizando documentos...' },
    { threshold: 180, message: 'Processamento avançado (arquivos grandes)...' }
  ],
  documents: [
    { threshold: 0, message: 'Montando estrutura...' },
    { threshold: 3, message: 'Aplicando formatação...' },
    { threshold: 8, message: 'Gerando conteúdo...' },
    { threshold: 15, message: 'Otimizando layout...' },
    { threshold: 25, message: 'Finalizando documento...' }
  ],
  consultor: [
    { threshold: 0, message: 'Analisando solicitação...' },
    { threshold: 3, message: 'Consultando base de conhecimento...' },
    { threshold: 8, message: 'Estruturando resposta...' },
    { threshold: 15, message: 'Finalizando análise...' }
  ],
  thinking: [
    'Pensando...',
    'Organizando ideias...',
    'Analisando contexto...',
    'Conectando informações...',
    'Estruturando resposta...'
  ]
};
