import React from 'react';

export interface StableCanvasProps {
  dadosIniciais?: Partial<Record<string, string>>;
  onComplete: (dados: Record<string, string>) => void;
}

const campos = [
  { name: 'segmentos_clientes', label: 'Segmentos de Clientes', placeholder: 'Quem são seus clientes-alvo?', rows: 3 },
  { name: 'proposta_valor', label: 'Proposta de Valor', placeholder: 'Que valor você entrega?', rows: 3 },
  { name: 'canais', label: 'Canais', placeholder: 'Como você alcança os clientes?', rows: 2 },
  { name: 'relacionamento', label: 'Relacionamento', placeholder: 'Como você se relaciona com clientes?', rows: 2 },
  { name: 'fontes_receita', label: 'Fontes de Receita', placeholder: 'Como você gera receita?', rows: 2 },
  { name: 'recursos_chave', label: 'Recursos-Chave', placeholder: 'Quais recursos são essenciais?', rows: 2 },
  { name: 'atividades_chave', label: 'Atividades-Chave', placeholder: 'O que você faz de mais importante?', rows: 2 },
  { name: 'parcerias_chave', label: 'Parcerias-Chave', placeholder: 'Quem são seus parceiros estratégicos?', rows: 2 },
  { name: 'estrutura_custos', label: 'Estrutura de Custos', placeholder: 'Quais são seus principais custos?', rows: 2 },
];

const StableCanvas: React.FC<StableCanvasProps> = ({ dadosIniciais = {}, onComplete }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-blue-400">Business Model Canvas</h2>
      <p className="text-gray-300">Mapeie seu modelo de negócio nos 9 blocos do Canvas</p>
      <form
        onSubmit={e => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const dados = Object.fromEntries(formData.entries()) as Record<string, string>;
          onComplete(dados);
        }}
        className="space-y-4"
      >
        {campos.map(campo => (
          <div key={campo.name}>
            <label className="block text-sm font-medium text-gray-300 mb-2">{campo.label}</label>
            <textarea
              name={campo.name}
              rows={campo.rows}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={campo.placeholder}
              required={campo.name !== 'parcerias_chave'}
              defaultValue={dadosIniciais[campo.name] || ''}
            />
          </div>
        ))}
        <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
          Concluir Canvas
        </button>
      </form>
    </div>
  );
};

export default StableCanvas;
