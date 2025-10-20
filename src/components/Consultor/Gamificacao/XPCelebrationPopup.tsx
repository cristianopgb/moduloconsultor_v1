// web/src/components/Consultor/Gamificacao/XPCelebrationPopup.tsx
import React, { useEffect, useState } from 'react';
import { Trophy, Star, Zap, TrendingUp, Sparkles } from 'lucide-react';
import { XP_POR_NIVEL } from '../../../lib/consultor/constants';

interface XPCelebrationPopupProps {
  xpGanho: number;
  xpTotal: number;
  nivel: number;
  motivo: string;
  onClose: () => void;
}

type Confetti = { id: number; x: number; delay: number; duration: number; color: string };

export function XPCelebrationPopup({ xpGanho, xpTotal, nivel, motivo, onClose }: XPCelebrationPopupProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  // Normalizações/segurança
  const xpPorNivel = XP_POR_NIVEL && XP_POR_NIVEL > 0 ? XP_POR_NIVEL : 1000;
  const totalSafe = Number.isFinite(xpTotal) && xpTotal >= 0 ? xpTotal : 0;
  const ganhoSafe = Number.isFinite(xpGanho) && xpGanho >= 0 ? xpGanho : 0;
  const nivelSafe = Number.isFinite(nivel) && nivel > 0 ? nivel : 1;
  const xpAtualNivel = totalSafe % xpPorNivel;
  const progresso = Math.max(0, Math.min(100, (xpAtualNivel / xpPorNivel) * 100));

  useEffect(() => {
    // Gerar confete
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const confettiArray: Confetti[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setConfetti(confettiArray);

    // Auto-close após 4s
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn" role="dialog" aria-modal="true" aria-label="XP ganho">
      {/* Confete */}
      {confetti.map(conf => (
        <div
          key={conf.id}
          className="absolute w-2 h-2 rounded-full animate-fall"
          style={{
            left: `${conf.x}%`,
            top: '-20px',
            backgroundColor: conf.color,
            animationDelay: `${conf.delay}s`,
            animationDuration: `${conf.duration}s`
          }}
        />
      ))}

      {/* Card Principal */}
      <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-1 rounded-2xl shadow-2xl animate-scaleIn max-w-md w-full mx-4">
        <div className="bg-gray-900 rounded-2xl p-8 text-center relative overflow-hidden">
          {/* brilho de fundo */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse" />

          {/* Conteúdo */}
          <div className="relative z-10">
            {/* Ícone */}
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-full">
                <Zap className="w-12 h-12 text-white animate-bounce" fill="currentColor" />
              </div>
            </div>

            {/* Título */}
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 mb-2 animate-pulse">
              🎉 PARABÉNS! 🎉
            </h2>

            {/* XP Ganho */}
            <div className="mb-4">
              <div className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-3 rounded-full shadow-lg transform hover:scale-105 transition-transform">
                <span className="text-4xl font-black text-white">+{ganhoSafe.toLocaleString()}</span>
              </div>
            </div>

            {/* Motivo */}
            <p className="text-lg text-blue-300 mb-6 font-semibold flex items-center justify-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
              {motivo}
              <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
            </p>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 backdrop-blur p-4 rounded-xl border border-blue-500/30">
                <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{totalSafe.toLocaleString()}</p>
                <p className="text-sm text-gray-400">XP Total</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 backdrop-blur p-4 rounded-xl border border-purple-500/30">
                <Trophy className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">Nível {nivelSafe}</p>
                <p className="text-sm text-gray-400">Atual</p>
              </div>
            </div>

            {/* Barra de progresso para o próximo nível */}
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 mb-2">
              <p className="text-gray-300 text-sm mb-2">Rumo ao próximo nível</p>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-700 ease-out"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {xpAtualNivel} / {xpPorNivel} XP
              </p>
            </div>

            {/* Mensagem motivacional */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 backdrop-blur p-4 rounded-xl border border-green-500/30">
              <Sparkles className="w-5 h-5 text-green-400 inline mr-2" />
              <span className="text-green-300 font-medium">Continue assim! Você está arrasando!</span>
              <Sparkles className="w-5 h-5 text-green-400 inline ml-2" />
            </div>

            {/* Botão fechar (opcional) */}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-full font-medium transition-all transform hover:scale-105"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .animate-fall { animation: fall linear infinite; }
      `}</style>
    </div>
  );
}
