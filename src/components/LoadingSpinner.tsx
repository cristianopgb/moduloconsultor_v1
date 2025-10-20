import React from 'react'
import { Brain } from 'lucide-react'

interface LoadingSpinnerProps {
  timeout?: number
}

export function LoadingSpinner({ timeout = 5000 }: LoadingSpinnerProps) {
  const [showTimeout, setShowTimeout] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true)
    }, timeout)

    return () => clearTimeout(timer)
  }, [timeout])

  if (showTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin"></div>
          <div className="text-white font-medium">Erro ao carregar</div>
          <div className="text-gray-400 text-sm max-w-md">
            O sistema está demorando para responder. Verifique sua conexão ou recarregue a página.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-6 h-6 text-blue-500" />
          </div>
        </div>
        <div className="text-white font-medium">Carregando proceda.ia...</div>
        <div className="text-gray-400 text-sm">Inicializando sistema</div>
      </div>
    </div>
  )
}