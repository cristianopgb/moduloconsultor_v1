import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles, X, TrendingUp } from 'lucide-react';
import { XP_POR_NIVEL } from '../../../lib/consultor/constants';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  nivelAntigo: number;
  nivelNovo: number;
  xpTotal: number;
}

export function LevelUpModal({ isOpen, onClose, nivelAntigo, nivelNovo, xpTotal }: LevelUpModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnimation(true);
      const timer = setTimeout(() => setShowAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nivelAnt = Number.isFinite(nivelAntigo) ? nivelAntigo : 1;
  const nivelAtu = Number.isFinite(nivelNovo) ? nivelNovo : Math.max(1, nivelAnt + 1);
  const xpTotalSafe = Number.isFinite(xpTotal) ? xpTotal : 0;

  const xpPorNivel = XP_POR_NIVEL && XP_POR_NIVEL > 0 ? XP_POR_NIVEL : 1000;
  const xpAtualNivel = xpTotalSafe % xpPorNivel;
  const progresso = Math.max(0, Math.min(100, (xpAtualNivel / xpPorNivel) * 100));

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Level Up"
    >
      <div className="relative bg-gradient-to-br from-yellow-900/90 to-orange-900/90 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-yellow-500/50">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors z-10"
          aria-label="Fechar"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="relative p-8 text-center">
          {showAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <Sparkles
                  key={i}
                  className="absolute w-6 h-6 text-yellow-300 animate-ping"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${1 + Math.random()}s`
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative z-10">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <Trophy className="w-24 h-24 text-yellow-300 animate-bounce" />
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg animate-pulse">
                  {nivelAtu}
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2 animate-slideDown">Level Up!</h2>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <p className="text-sm text-yellow-200">Nível Anterior</p>
                <p className="text-2xl font-bold text-white">{nivelAnt}</p>
              </div>

              <TrendingUp className="w-6 h-6 text-yellow-300" />

              <div className="bg-yellow-500/30 px-4 py-2 rounded-lg border-2 border-yellow-400">
                <p className="text-sm text-yellow-200">Nível Atual</p>
                <p className="text-2xl font-bold text-white">{nivelAtu}</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
              <p className="text-yellow-100 text-sm mb-2">Experiência Total</p>
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <p className="text-3xl font-bold text-white">{xpTotalSafe.toLocaleString()}</p>
                <span className="text-yellow-200 text-sm">XP</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-yellow-100 text-sm mb-2">Próximo Nível</p>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-1000 ease-out"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-xs text-gray-300 mt-2">
                {xpAtualNivel} / {xpPorNivel} XP
              </p>
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
            >
              Continuar Jornada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default LevelUpModal;
