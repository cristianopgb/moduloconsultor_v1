import { useEffect, useState } from 'react';
import { Loader2, Clock, Sparkles, Brain, Circle } from 'lucide-react';

interface ProgressIndicatorProps {
  messages: string[];
  interval?: number;
  icon?: 'spinner' | 'pulse' | 'sparkle' | 'brain';
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  progress?: number;
  showTimer?: boolean;
  elapsedSeconds?: number;
  className?: string;
}

export function ProgressIndicator({
  messages,
  interval = 2000,
  icon = 'spinner',
  size = 'md',
  showProgress = false,
  progress,
  showTimer = false,
  elapsedSeconds = 0,
  className = ''
}: ProgressIndicatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (messages.length <= 1) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        setIsTransitioning(false);
      }, 150);
    }, interval);

    return () => clearInterval(timer);
  }, [messages.length, interval]);

  const icons = {
    spinner: <Loader2 className="animate-spin" />,
    pulse: <Circle className="animate-pulse" />,
    sparkle: <Sparkles className="animate-pulse" />,
    brain: <Brain className="animate-pulse" />
  };

  const sizeClasses = {
    sm: 'text-xs gap-1.5',
    md: 'text-sm gap-2',
    lg: 'text-base gap-2.5'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentMessage = messages[currentMessageIndex] || messages[0] || 'Processando...';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`flex items-center ${sizeClasses[size]} text-gray-400`}>
        <div className={iconSizes[size]}>
          {icons[icon]}
        </div>

        <span
          className={`transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {showTimer && elapsedSeconds > 0 && (
            <span className="text-gray-500 mr-1.5">
              {formatTime(elapsedSeconds)} •
            </span>
          )}
          {currentMessage}
          {showProgress && progress !== undefined && (
            <span className="ml-1.5 text-gray-500">
              {Math.round(progress)}%
            </span>
          )}
        </span>
      </div>

      {showProgress && progress !== undefined && (
        <div className="w-64 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
