import React from 'react'
import { Bell, BellOff, Settings } from 'lucide-react'
import { usePWA } from '../../hooks/usePWA'

export function NotificationManager() {
  const { notificationPermission, requestNotificationPermission, sendNotification } = usePWA()
  const [showSettings, setShowSettings] = React.useState(false)

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission()
    if (granted) {
      sendNotification('Notificações Ativadas!', {
        body: 'Você receberá alertas importantes do sistema',
        tag: 'welcome'
      })
    }
  }

  const testNotification = () => {
    sendNotification('Teste de Notificação', {
      body: 'Esta é uma notificação de teste do proceda.ia',
      tag: 'test',
      requireInteraction: true
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={`p-2 rounded-lg transition-colors ${
          notificationPermission === 'granted'
            ? 'text-green-400 hover:bg-green-900/20'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
        title="Configurações de Notificação"
      >
        {notificationPermission === 'granted' ? (
          <Bell className="w-5 h-5" />
        ) : (
          <BellOff className="w-5 h-5" />
        )}
      </button>

      {showSettings && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-medium">Notificações Push</h3>
            </div>

            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${
                notificationPermission === 'granted' 
                  ? 'border-green-500/30 bg-green-900/20'
                  : notificationPermission === 'denied'
                  ? 'border-red-500/30 bg-red-900/20'
                  : 'border-yellow-500/30 bg-yellow-900/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {notificationPermission === 'granted' ? (
                    <Bell className="w-4 h-4 text-green-400" />
                  ) : (
                    <BellOff className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    notificationPermission === 'granted' ? 'text-green-400' :
                    notificationPermission === 'denied' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    Status: {
                      notificationPermission === 'granted' ? 'Ativadas' :
                      notificationPermission === 'denied' ? 'Bloqueadas' : 'Não Configuradas'
                    }
                  </span>
                </div>
                <p className={`text-xs ${
                  notificationPermission === 'granted' ? 'text-green-300' :
                  notificationPermission === 'denied' ? 'text-red-300' : 'text-yellow-300'
                }`}>
                  {notificationPermission === 'granted' 
                    ? 'Você receberá notificações importantes'
                    : notificationPermission === 'denied'
                    ? 'Notificações foram bloqueadas pelo navegador'
                    : 'Clique para ativar notificações push'
                  }
                </p>
              </div>

              {notificationPermission === 'default' && (
                <button
                  onClick={handleEnableNotifications}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Bell className="w-4 h-4" />
                  Ativar Notificações
                </button>
              )}

              {notificationPermission === 'granted' && (
                <button
                  onClick={testNotification}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Bell className="w-4 h-4" />
                  Testar Notificação
                </button>
              )}

              {notificationPermission === 'denied' && (
                <div className="text-xs text-gray-400">
                  Para ativar, vá nas configurações do navegador e permita notificações para este site.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}