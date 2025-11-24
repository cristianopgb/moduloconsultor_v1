import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Brain } from 'lucide-react';

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

  // Color schemes for coordinated icon + text colors
  const colorSchemes = {
    spinner: { icon: 'text-blue-400', text: 'text-blue-200' },
    pulse: { icon: 'text-gray-300', text: 'text-gray-200' },
    sparkle: { icon: 'text-purple-400', text: 'text-purple-200' },
    brain: { icon: 'text-cyan-400', text: 'text-cyan-200' }
  };

  // Get color scheme for current icon type
  const colors = colorSchemes[icon];

  // Icons are now functions that accept size class
  const getIcon = (iconType: typeof icon, sizeClass: string) => {
    switch (iconType) {
      case 'spinner':
        return <Loader2 className={`${sizeClass} ${colors.icon} animate-spin`} />;
      case 'pulse':
        return <Loader2 className={`${sizeClass} ${colors.icon} animate-pulse`} />;
      case 'sparkle':
        return <Sparkles className={`${sizeClass} ${colors.icon} animate-pulse`} />;
      case 'brain':
        return <Brain className={`${sizeClass} ${colors.icon} animate-pulse`} />;
      default:
        return <Loader2 className={`${sizeClass} ${colors.icon} animate-spin`} />;
    }
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
      <div className={`flex items-center ${sizeClasses[size]}`}>
        {getIcon(icon, iconSizes[size])}

        <span
          className={`${colors.text} transition-opacity duration-150 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {showTimer && elapsedSeconds > 0 && (
            <span className={`${colors.text} mr-1.5`}>
              {formatTime(elapsedSeconds)} •
            </span>
          )}
          {currentMessage}
          {showProgress && progress !== undefined && (
            <span className={`ml-1.5 ${colors.text}`}>
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
