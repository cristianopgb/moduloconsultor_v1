// web/src/components/Consultor/Forms/DynamicFormAnamnese.tsx
import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, MessageCircle, CheckCircle } from 'lucide-react';

interface FormField {
  id: string;
  tipo: 'text' | 'select' | 'radio' | 'textarea';
  label: string;
  placeholder?: string;
  opcoes?: string[] | { valor: string; label: string }[];
  obrigatorio?: boolean;
}

interface FormGroup {
  titulo: string;
  descricao: string;
  perguntas: FormField[];
}

interface DynamicFormAnamneseProps {
  onComplete: (dados: Record<string, any>) => void;
  onInterrupt: () => void;
  dadosIniciais?: Record<string, any> | null;
}

export function DynamicFormAnamnese({
  onComplete,
  onInterrupt,
  dadosIniciais = null
}: DynamicFormAnamneseProps) {
  const [currentGroup, setCurrentGroup] = useState(0);
  // garante objeto válido mesmo que venha null/undefined
  const [responses, setResponses] = useState<Record<string, any>>(
    dadosIniciais && typeof dadosIniciais === 'object' ? dadosIniciais : {}
  );

  const formGroups: FormGroup[] = [
    {
      titulo: 'Perfil Empresarial',
      descricao: 'Vamos conhecer você e sua empresa.',
      perguntas: [
        {
          id: 'nome_usuario',
          tipo: 'text',
          label: 'Seu nome',
          placeholder: 'Ex: João Silva',
          obrigatorio: true
        },
        {
          id: 'cargo',
          tipo: 'select',
          label: 'Seu cargo',
          opcoes: ['Proprietário', 'Sócio', 'Diretor', 'Gerente', 'Outro'],
          obrigatorio: true
        },
        {
          id: 'empresa_nome',
          tipo: 'text',
          label: 'Nome da empresa',
          placeholder: 'Ex: Empresa ABC Ltda',
          obrigatorio: true
        }
      ]
    },
    {
      titulo: 'Características do Negócio',
      descricao: 'Contexto e porte da sua empresa.',
      perguntas: [
        {
          id: 'segmento',
          tipo: 'select',
          label: 'Segmento de atuação',
          opcoes: [
            'E-commerce',
            'Serviços',
            'Indústria',
            'Varejo',
            'Construção',
            'Tecnologia',
            'Consultoria',
            'Outro'
          ],
          obrigatorio: true
        },
        {
          id: 'porte',
          tipo: 'radio',
          label: 'Porte da empresa',
          opcoes: [
            { valor: 'micro', label: 'Micro (até 9 funcionários)' },
            { valor: 'pequena', label: 'Pequena (10-49 funcionários)' },
            { valor: 'media', label: 'Média (50-249 funcionários)' },
            { valor: 'grande', label: 'Grande (250+ funcionários)' }
          ],
          obrigatorio: true
        },
        {
          id: 'tempo_mercado',
          tipo: 'select',
          label: 'Tempo de mercado',
          opcoes: [
            'Menos de 1 ano',
            '1-3 anos',
            '3-5 anos',
            '5-10 anos',
            'Mais de 10 anos'
          ]
        }
      ]
    },
    {
      titulo: 'Desafios e Objetivos',
      descricao: 'O que te trouxe até aqui?',
      perguntas: [
        {
          id: 'desafios_principais',
          tipo: 'textarea',
          label: 'Quais os principais desafios da sua empresa hoje?',
          placeholder: 'Ex: Dificuldade em controlar estoque, time desorganizado, falta de processos...',
          obrigatorio: true
        },
        {
          id: 'objetivo_sucesso',
          tipo: 'textarea',
          label: 'Qual seria o cenário ideal de sucesso para sua empresa?',
          placeholder: 'Ex: Ter processos claros, equipe alinhada, faturamento previsível, crescimento sustentável...',
          obrigatorio: true
        },
        {
          id: 'expectativa_sucesso',
          tipo: 'textarea',
          label: 'O que você espera alcançar com esta consultoria?',
          placeholder: 'Ex: Dobrar faturamento, reduzir desperdícios, organizar operação, melhorar gestão...',
          obrigatorio: true
        },
        {
          id: 'metas_curto_prazo',
          tipo: 'textarea',
          label: 'Metas para os próximos 3 meses',
          placeholder: 'O que você quer alcançar no curto prazo?'
        },
        {
          id: 'metas_medio_prazo',
          tipo: 'textarea',
          label: 'Metas para os próximos 6-12 meses',
          placeholder: 'Onde você quer estar daqui 1 ano?'
        }
      ]
    }
  ];

  const handleFieldChange = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const isGroupComplete = () => {
    const group = formGroups[currentGroup];
    if (!group || !group.perguntas) return false;

    return group.perguntas
      .filter(p => p.obrigatorio)
      .every(p => {
        const value = responses[p.id];
        if (value === null || value === undefined) return false;
        return String(value).trim() !== '';
      });
  };

  const handleNext = () => {
    if (currentGroup < formGroups.length - 1) {
      setCurrentGroup(prev => prev + 1);
    } else {
      const dadosCompletos = { ...responses };
      onComplete(dadosCompletos);
    }
  };

  const handlePrevious = () => {
    if (currentGroup > 0) {
      setCurrentGroup(prev => prev - 1);
    }
  };

  const currentGroupData = formGroups[currentGroup];
  const progressPercent = ((currentGroup + 1) / formGroups.length) * 100;

  // fallback visual em caso extremo
  if (!currentGroupData) {
    return (
      <div className="bg-gray-900 border border-blue-500/30 rounded-lg shadow-lg max-w-2xl mx-auto p-6">
        <p className="text-red-400 text-sm">Erro ao carregar formulário. Recarregue a página.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg max-w-2xl mx-auto overflow-hidden">
      {/* Cabeçalho */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-blue-400">{currentGroupData.titulo}</h3>
          <span className="text-sm text-gray-400">
            {currentGroup + 1} de {formGroups.length}
          </span>
        </div>
        <p className="text-sm text-gray-300 mb-4">{currentGroupData.descricao}</p>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Corpo */}
      <div className="p-6 space-y-4">
        {currentGroupData.perguntas && currentGroupData.perguntas.map((pergunta) => (
          <div key={pergunta.id}>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              {pergunta.label}
              {pergunta.obrigatorio && <span className="text-red-400 ml-1">*</span>}
            </label>

            {pergunta.tipo === 'text' && (
              <input
                type="text"
                value={responses[pergunta.id] || ''}
                onChange={(e) => handleFieldChange(pergunta.id, e.target.value)}
                placeholder={pergunta.placeholder}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}

            {pergunta.tipo === 'select' && (
              <select
                value={responses[pergunta.id] || ''}
                onChange={(e) => handleFieldChange(pergunta.id, e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {pergunta.opcoes && pergunta.opcoes.map((opcao) => (
                  <option
                    key={typeof opcao === 'string' ? opcao : opcao.valor}
                    value={typeof opcao === 'string' ? opcao : opcao.valor}
                  >
                    {typeof opcao === 'string' ? opcao : opcao.label}
                  </option>
                ))}
              </select>
            )}

            {pergunta.tipo === 'radio' && (
              <div className="space-y-2">
                {pergunta.opcoes && pergunta.opcoes.map((opcao) => {
                  const valor = typeof opcao === 'string' ? opcao : opcao.valor;
                  const label = typeof opcao === 'string' ? opcao : opcao.label;
                  return (
                    <label
                      key={valor}
                      className="flex items-center p-3 border border-gray-700 rounded-lg hover:bg-gray-800 cursor-pointer text-gray-200"
                    >
                      <input
                        type="radio"
                        name={pergunta.id}
                        value={valor}
                        checked={responses[pergunta.id] === valor}
                        onChange={(e) => handleFieldChange(pergunta.id, e.target.value)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm text-gray-200">{label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {pergunta.tipo === 'textarea' && (
              <textarea
                value={responses[pergunta.id] || ''}
                onChange={(e) => handleFieldChange(pergunta.id, e.target.value)}
                placeholder={pergunta.placeholder}
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="p-6 bg-gray-950 border-t border-gray-800 flex items-center justify-between">
        <button
          onClick={onInterrupt}
          className="flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Conversar com Consultor</span>
        </button>

        <div className="flex gap-2">
          {currentGroup > 0 && (
            <button
              onClick={handlePrevious}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!isGroupComplete()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{currentGroup === formGroups.length - 1 ? 'Finalizar' : 'Próximo'}</span>
            {currentGroup === formGroups.length - 1 ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
