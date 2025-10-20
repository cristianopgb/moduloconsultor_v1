import React from 'react'
import { Download, X, Smartphone, Monitor } from 'lucide-react'
import { usePWA } from '../../hooks/usePWA'

export function PWAInstallPrompt() {
  const { isInstallable, installApp } = usePWA()
  const [showPrompt, setShowPrompt] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = window.setTimeout(() => {
        setShowPrompt(true)
      }, 3000) // Show after 3 seconds

      return () => window.clearTimeout(timer)
    }
  }, [isInstallable, dismissed])

  const handleInstall = async () => {
    const success = await installApp()
    if (success) {
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  React.useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa-install-dismissed')
    if (wasDismissed) {
      setDismissed(true)
    }
  }, [])

  if (!showPrompt || !isInstallable || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 shadow-2xl z-50 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">Instalar proceda.ia</h3>
          <p className="text-blue-100 text-sm mb-3">
            Adicione à tela inicial para acesso rápido e notificações
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}