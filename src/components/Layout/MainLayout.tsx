import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNavigation } from './MobileNavigation'
import { PWAInstallPrompt } from '../PWA/PWAInstallPrompt'
import { OfflineIndicator } from '../PWA/OfflineIndicator'

interface MainLayoutProps {
  children: React.ReactNode
  isMaster?: boolean
}

export function MainLayout({ children, isMaster = false }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      <Sidebar 
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        isMaster={isMaster}
      />
      
      <div className="flex-1 flex flex-col lg:ml-0">
        <Header onMenuToggle={toggleSidebar} />
        
        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 md:pb-4">
          {children}
        </main>
        
        <MobileNavigation 
          isMaster={isMaster}
        />
      </div>
      
      <PWAInstallPrompt />
      <OfflineIndicator />
    </div>
  )
}