import { BarChart3, Wand2, FileText, MessageSquare } from 'lucide-react';

interface Props {
  narrative: {
    headline: string;
    executive_summary: string;
    key_insights: Array<{
      title: string;
      description: string;
      numbers: string[];
      importance: 'high' | 'medium' | 'low';
      emoji: string;
    }>;
    visualizations: Array<{
      type: string;
      title: string;
      data: any;
      interpretation: string;
    }>;
    business_recommendations: Array<{
      action: string;
      rationale: string;
      expected_impact: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    next_questions: string[];
    executed_queries?: Array<{
      purpose_user_friendly: string;
      results: any[];
      success: boolean;
    }>;
  };
  onAskMore: (question?: string) => void;
  onExport: () => void;
}

export function ExecutiveReport({ narrative, onAskMore, onExport }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-6 h-6" />
          <span className="text-sm font-medium opacity-90">Análise Concluída</span>
        </div>
        <h2 className="text-2xl font-bold">{narrative.headline}</h2>
        <p className="text-blue-100 mt-2">{narrative.executive_summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {narrative.key_insights.map((insight, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 border-2 ${
              insight.importance === 'high'
                ? 'bg-red-50 border-red-200'
                : insight.importance === 'medium'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{insight.emoji}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                <div className="space-y-1">
                  {insight.numbers.map((num, j) => (
                    <div key={j} className="text-xs font-medium text-gray-600">
                      • {num}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {narrative.visualizations && narrative.visualizations.length > 0 && narrative.visualizations.map((viz, i) => (
        <div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{viz.title}</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg mb-4">
            <div className="text-gray-400 text-sm">
              Gráfico {viz.type} - Dados: {JSON.stringify(viz.data).substring(0, 50)}...
            </div>
          </div>
          <p className="text-sm text-gray-600 italic">{viz.interpretation}</p>
        </div>
      ))}

      {narrative.executed_queries && narrative.executed_queries.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            📊 Dados Analisados
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Todas as análises que executei para chegar nos insights acima:
          </p>
          <div className="space-y-4">
            {narrative.executed_queries.filter(q => q.success && q.results && q.results.length > 0).map((query, i) => (
              <div key={i} className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-gray-900 mb-2">{query.purpose_user_friendly}</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200 rounded">
                    <thead className="bg-gray-50">
                      <tr>
                        {query.results[0] && Object.keys(query.results[0]).map(col => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {query.results.slice(0, 10).map((row, j) => (
                        <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {Object.values(row).map((val, k) => (
                            <td key={k} className="px-3 py-2 text-gray-700 border-b border-gray-100">
                              {typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val || '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {query.results.length > 10 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Mostrando 10 de {query.results.length} resultados
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative.business_recommendations && narrative.business_recommendations.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-500" />
            Recomendações
          </h3>
          <div className="space-y-4">
            {narrative.business_recommendations.map((rec, i) => (
              <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
                <h4 className="font-medium text-gray-900">{rec.action}</h4>
                <p className="text-sm text-gray-600 mt-1">{rec.rationale}</p>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  Impacto esperado: {rec.expected_impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative.next_questions && narrative.next_questions.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Continue explorando seus dados</h3>
          <div className="space-y-2">
            {narrative.next_questions.map((q, i) => (
              <button
                key={i}
                onClick={() => onAskMore(q)}
                className="w-full text-left px-4 py-2 bg-white rounded-lg hover:bg-purple-100 transition-colors text-sm text-gray-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onExport}
          className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Baixar relatório
        </button>
        <button
          onClick={() => onAskMore()}
          className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Fazer outra pergunta
        </button>
      </div>
    </div>
  );
}
