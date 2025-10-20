import React, { useEffect } from 'react';
import { Award, X, Star, Sparkles } from 'lucide-react';
import type { Conquista } from '../../../types/consultor';

interface ConquistaModalProps {
  isOpen: boolean;
  onClose: () => void;
  conquista: Conquista;
}

export function ConquistaModal({ isOpen, onClose, conquista }: ConquistaModalProps) {
  useEffect(() => {
    if (isOpen) {
      launchConfetti();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function launchConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      if (typeof window !== 'undefined' && (window as any).confetti) {
        (window as any).confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        (window as any).confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }
    }, 250);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-purple-500/50 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors z-10"
          aria-label="Fechar"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="relative p-8 text-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[...Array(15)].map((_, i) => (
              <Star
                key={i}
                className="absolute w-4 h-4 text-yellow-300 animate-ping"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1.5 + Math.random()}s`
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-bounce shadow-2xl">
                  <Award className="w-20 h-20 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg shadow-lg animate-pulse border-2 border-white">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="mb-2 inline-block px-4 py-1 bg-purple-500/30 rounded-full border border-purple-400">
              <p className="text-purple-200 text-sm font-semibold uppercase tracking-wider">
                Conquista Desbloqueada
              </p>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3 animate-slideDown">
              {conquista.nome}
            </h2>

            <p className="text-purple-100 text-lg mb-6 leading-relaxed">
              {conquista.descricao}
            </p>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
              <p className="text-purple-200 text-sm mb-2">Recompensa</p>
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                <p className="text-3xl font-bold text-white">{conquista.xp_ganho}</p>
                <span className="text-purple-200 text-sm">XP</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-3 mb-6 border border-purple-500/30">
              <p className="text-purple-100 text-xs">
                Desbloqueado em {new Date(conquista.data_desbloqueio).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Continuar Jornada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConquistaModal;
