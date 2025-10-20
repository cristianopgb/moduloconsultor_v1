import React, { useState } from 'react'
import { Play, AlertCircle, CheckCircle, Clock, Code } from 'lucide-react'
import type { QueryDSL, QueryExecutionResult } from '../../types/query-dsl'

interface DatasetQueryBuilderProps {
  datasetId: string
  hasQueryableData: boolean
  onQueryExecuted?: (result: QueryExecutionResult) => void
}

export function DatasetQueryBuilder({ datasetId, hasQueryableData, onQueryExecuted }: DatasetQueryBuilderProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dsl, setDsl] = useState<QueryDSL | null>(null)
  const [result, setResult] = useState<QueryExecutionResult | null>(null)
  const [showDSL, setShowDSL] = useState(false)

  if (!hasQueryableData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-900 mb-1">Query Dinâmica Não Disponível</h3>
            <p className="text-sm text-yellow-700">
              Este dataset não possui dados queryáveis. Para habilitar queries dinâmicas,
              faça o upload novamente com a opção "Armazenar dados queryáveis" ativada.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handlePlanQuery = async () => {
    if (!question.trim()) {
      setError('Digite uma pergunta')
      return
    }

    setLoading(true)
    setError('')
    setDsl(null)
    setResult(null)

    try {
      // Call plan-query function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plan-query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dataset_id: datasetId,
            question: question.trim()
          })
        }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Falha ao planejar query')
      }

      setDsl(data.dsl)
      console.log('[DEBUG] DSL generated:', data.dsl)

    } catch (err: any) {
      console.error('[ERROR] Plan query failed:', err)
      setError(err.message || 'Erro ao planejar query')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteQuery = async () => {
    if (!dsl) {
      setError('Nenhuma query planejada')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Call query-dataset function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-dataset`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dsl })
        }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Falha ao executar query')
      }

      setResult(data.result)
      onQueryExecuted?.(data.result)
      console.log('[SUCCESS] Query executed:', data.result)

    } catch (err: any) {
      console.error('[ERROR] Execute query failed:', err)
      setError(err.message || 'Erro ao executar query')
    } finally {
      setLoading(false)
    }
  }

  const handlePlanAndExecute = async () => {
    await handlePlanQuery()
    // Wait a bit for DSL to be set
    setTimeout(async () => {
      if (dsl) {
        await handleExecuteQuery()
      }
    }, 100)
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Query Dinâmica Habilitada</h3>
            <p className="text-sm text-blue-700">
              Este dataset possui dados queryáveis. Faça perguntas em linguagem natural
              e obtenha resultados calculados diretamente dos dados reais.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Faça uma pergunta sobre os dados
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Mostre as vendas totais por mês em 2024"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePlanAndExecute}
            disabled={loading || !question.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Executando...' : 'Executar Query'}
          </button>

          <button
            onClick={() => setShowDSL(!showDSL)}
            disabled={!dsl}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            <Code className="w-4 h-4" />
            {showDSL ? 'Ocultar DSL' : 'Ver DSL'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-1">Erro</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {dsl && showDSL && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Code className="w-4 h-4" />
            Como a IA entendeu sua pergunta (DSL)
          </h3>
          <pre className="text-xs text-gray-700 overflow-x-auto bg-white p-3 rounded border border-gray-200">
            {JSON.stringify(dsl, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-green-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Resultado da Query
            </h3>
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Clock className="w-4 h-4" />
              {result.execution_time_ms}ms
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {result.columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {result.rows.slice(0, 10).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-sm text-gray-900">
                        {typeof cell === 'number' ? cell.toLocaleString('pt-BR') : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.row_count > 10 && (
            <p className="text-sm text-gray-600 mt-2">
              Mostrando 10 de {result.row_count} resultados
              {result.was_limited && ` (limitado a ${result.actual_limit})`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
