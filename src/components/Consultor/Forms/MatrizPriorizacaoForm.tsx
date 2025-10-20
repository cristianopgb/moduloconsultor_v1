// web/src/components/Consultor/Forms/MatrizPriorizacaoForm.tsx
import React, { useState } from 'react';
import { CheckCircle, Info } from 'lucide-react';

interface Processo {
  id: string;
  nome: string;
  area?: string;
}

interface Avaliacao {
  desafio_relatado: number;
  impacto_operacional: number;
  complexidade: number;        // 1=simples … 5=muito complexo (no cálculo é invertido)
  tempo: number;               // 1=rápido … 5=muito longo     (no cálculo é invertido)
  retorno_financeiro: number;
}

interface MatrizPriorizacaoFormProps {
  processos: Processo[];
  onComplete: (avaliacoes: Record<string, Avaliacao>) => void;
}

export function MatrizPriorizacaoForm({ processos, onComplete }: MatrizPriorizacaoFormProps) {
  const [avaliacoes, setAvaliacoes] = useState<Record<string, Avaliacao>>({});
  const [processoAtual, setProcessoAtual] = useState(0);

  const criterios = [
    {
      key: 'desafio_relatado' as keyof Avaliacao,
      label: 'Desafio relatado pelo cliente',
      descricao: 'De 1 (pouco incômodo) a 5 (muito crítico).',
      peso: 3
    },
    {
      key: 'impacto_operacional' as keyof Avaliacao,
      label: 'Impacto operacional',
      descricao: 'De 1 (baixo) a 5 (transformacional).',
      peso: 3
    },
    {
      key: 'retorno_financeiro' as keyof Avaliacao,
      label: 'Retorno financeiro',
      descricao: 'De 1 (baixo) a 5 (alto).',
      peso: 2
    },
    {
      key: 'complexidade' as keyof Avaliacao,
      label: 'Complexidade para implementar',
      descricao: 'De 1 (simples) a 5 (muito complexo). — Quanto MENOR, melhor.',
      peso: -2
    },
    {
      key: 'tempo' as keyof Avaliacao,
      label: 'Tempo de implementação',
      descricao: 'De 1 (rápido) a 5 (muito longo). — Quanto MENOR, melhor.',
      peso: -1
    }
  ];

  // Score final (quanto MAIOR, maior prioridade)
  const calcularScore = (processoId: string): number => {
    const a = avaliacoes[processoId];
    if (!a) return 0;

    // Desafio(3), Impacto(3), Retorno(2) — diretos
    // Complexidade(-2) e Tempo(-1) — menores são melhores (invertidos para somar)
    return (
      a.desafio_relatado * 3 +
      a.impacto_operacional * 3 +
      a.retorno_financeiro * 2 +
      (6 - a.complexidade) * 2 + // invertendo (1..5) -> (5..1) usando (6 - valor)
      (6 - a.tempo) * 1
    );
  };

  const updateAvaliacao = (processoId: string, criterio: keyof Avaliacao, valor: number) => {
    setAvaliacoes(prev => ({
      ...prev,
      [processoId]: {
        ...prev[processoId],
        [criterio]: valor
      } as Avaliacao
    }));
  };

  const isProcessoCompleto = (processoId: string): boolean => {
    const a = avaliacoes[processoId];
    if (!a) return false;
    return criterios.every(c => {
      const v = a[c.key] as number | undefined;
      return typeof v === 'number' && v >= 1 && v <= 5; // força 1..5
    });
  };

  const todasAvaliacoesCompletas = processos.length > 0 && processos.every(p => isProcessoCompleto(p.id));

  const getScoreColor = (score: number): string => {
    if (score >= 20) return 'text-red-300 bg-red-900/30 border border-red-800';
    if (score >= 16) return 'text-orange-300 bg-orange-900/30 border border-orange-800';
    if (score >= 12) return 'text-yellow-300 bg-yellow-900/30 border border-yellow-800';
    return 'text-green-300 bg-green-900/30 border border-green-800';
  };

  const getPrioridade = (score: number): string => {
    if (score >= 20) return 'ALTA';
    if (score >= 16) return 'MÉDIA-ALTA';
    if (score >= 12) return 'MÉDIA';
    return 'BAIXA';
  };

  const handleProximoProcesso = () => {
    if (processoAtual < processos.length - 1) setProcessoAtual(prev => prev + 1);
  };

  const handleProcessoAnterior = () => {
    if (processoAtual > 0) setProcessoAtual(prev => prev - 1);
  };

  if (!processos || processos.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
        <div className="flex items-start gap-3 justify-center mb-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-gray-300">
            Nenhum <b>processo</b> listado para priorização. Volte e selecione os <b>PROCESSOS</b> que serão trabalhados
            (não liste “problemas”). Ex.: “Roteirização de entregas”, “Conciliação financeira”.
          </div>
        </div>
      </div>
    );
  }

  const processo = processos[processoAtual];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 max-w-4xl mx-auto overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-6 bg-gray-950 border-b border-gray-800">
        <div className="flex items-start gap-3 mb-4">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-100 mb-2">Matriz de Priorização (PROCESSOS)</h3>
            <p className="text-sm text-gray-400">
              Avalie cada <b>processo</b> com notas de 1 a 5. Complexidade e Tempo: quanto MENOR, melhor.
              O sistema calcula a prioridade automaticamente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((processoAtual + 1) / processos.length) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-300">
            {processoAtual + 1}/{processos.length}
          </span>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-6">
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-100 mb-1">{processo.nome}</h4>
          {processo.area && (
            <p className="text-sm text-gray-400">Área: {processo.area}</p>
          )}
        </div>

        <div className="space-y-6">
          {criterios.map((criterio) => (
            <div key={criterio.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-200">
                    {criterio.label}
                  </label>
                  <p className="text-xs text-gray-500">{criterio.descricao}</p>
                </div>
                <span className="text-[11px] text-gray-500 font-mono">
                  Peso: {criterio.peso > 0 ? '+' : ''}{criterio.peso}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((valor) => (
                  <button
                    key={valor}
                    onClick={() => updateAvaliacao(processo.id, criterio.key, valor)}
                    className={`h-10 rounded-lg text-sm font-medium transition-all border
                      ${avaliacoes[processo.id]?.[criterio.key] === valor
                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-700/30'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750'
                      }`}
                  >
                    {valor}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {avaliacoes[processo.id] && isProcessoCompleto(processo.id) && (
          <div className={`mt-6 p-4 rounded-lg ${getScoreColor(calcularScore(processo.id))}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Score calculado</p>
                <p className="text-xs opacity-75">
                  Prioridade: {getPrioridade(calcularScore(processo.id))}
                </p>
              </div>
              <div className="text-3xl font-bold">
                {calcularScore(processo.id)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="p-6 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={handleProcessoAnterior}
          disabled={processoAtual === 0}
          className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Anterior
        </button>

        {processoAtual < processos.length - 1 ? (
          <button
            onClick={handleProximoProcesso}
            disabled={!isProcessoCompleto(processo.id)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo →
          </button>
        ) : (
          <button
            onClick={() => onComplete(avaliacoes)}
            disabled={!todasAvaliacoesCompletas}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Gerar Matriz</span>
          </button>
        )}
      </div>

      {todasAvaliacoesCompletas && (
        <div className="p-6 bg-gray-900 border-t border-gray-800">
          <h4 className="text-sm font-semibold text-gray-200 mb-3">Ranking de Priorização</h4>
          <div className="space-y-2">
            {processos
              .map(p => ({ processo: p, score: calcularScore(p.id) }))
              .sort((a, b) => b.score - a.score)
              .map((item, index) => (
                <div
                  key={item.processo.id}
                  className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-gray-800 text-gray-300 text-xs font-bold rounded-full">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-100">
                      {item.processo.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded ${getScoreColor(item.score)}`}>
                      {getPrioridade(item.score)}
                    </span>
                    <span className="text-sm font-bold text-gray-100">
                      {item.score}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
