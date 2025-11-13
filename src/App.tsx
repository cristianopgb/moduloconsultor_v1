import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthPage } from './components/AuthPage'
import { ChatPage } from './components/Chat/ChatPage'
import { PreviewPage } from './components/PreviewPage'
import { LoadingSpinner } from './components/LoadingSpinner'
import { Dashboard } from './components/Dashboard'
import { DatabaseTest } from './components/DatabaseTest'
import { TokensPage } from './components/Tokens/TokensPage'
import { DocumentsPage } from './components/Documents/DocumentsPage'
import { TemplatesPage } from './components/Templates/TemplatesPage'
import { UsersPage } from './components/Users/UsersPage'
import { ReportsPage } from './components/Reports/ReportsPage'
import { SystemSettings } from './components/Settings/SystemSettings'
import { SecurityPage } from './components/Security/SecurityPage'
import { AlertsPage } from './components/Alerts/AlertsPage'
import { BackupPage } from './components/Backup/BackupPage'
import { AIIntegrationsPage } from './components/AI/AIIntegrationsPage'
import { ProjectsPage } from './components/Projects/ProjectsPage'
import { ProjectManagementPage } from './components/Projects/ProjectManagementPage'
import { MainLayout } from './components/Layout/MainLayout'
import { DatasetsPage } from './components/Datasets/DatasetsPage'
// import { LearningPage } from './components/Admin/LearningPage' // Arquivo corrompido - temporariamente desabilitado
import AnalysisHealthDashboard from './components/Admin/AnalysisHealthDashboard'
import { KnowledgeManagementPage } from './components/Admin/KnowledgeManagementPage'
import { SectorAdaptersPage } from './components/Admin/SectorAdaptersPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

function ProtectedPage({ children, requireMaster = false }: { children: React.ReactNode, requireMaster?: boolean }) {
  const { user } = useAuth()

  // Detectar se é master baseado no email
  const isMaster = user?.email?.includes('master') || user?.email?.includes('admin')

  // Se a rota requer master e o usuário não é master, redirecionar
  if (requireMaster && !isMaster) {
    return <Navigate to="/chat" replace />
  }

  // Passar o isMaster real para o MainLayout, não o requireMaster
  return (
    <MainLayout isMaster={isMaster}>
      {children}
    </MainLayout>
  )
}
function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  try {
    return (
      <Routes>
        {/* Rota de autenticação */}
        <Route 
          path="/auth" 
          element={user ? <Navigate to="/chat" replace /> : <AuthPage />} 
        />
        
        {/* Rota principal - redireciona para chat se autenticado */}
        <Route 
          path="/" 
          element={user ? <Navigate to="/chat" replace /> : <Navigate to="/auth" replace />} 
        />
        
        {/* Rota do chat - página principal após login (SEM MainLayout - tem layout próprio) */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        
        {/* Rotas protegidas com layout */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <Dashboard />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/database-test" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <DatabaseTest />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/tokens" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <TokensPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/documents" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <DocumentsPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <ProjectsPage />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />

        <Route
          path="/projetos/:jornadaId"
          element={
            <ProtectedRoute>
              <ProjectManagementPage />
            </ProtectedRoute>
          }
        />
        
        <Route 
          path="/datasets" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <DatasetsPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <div className="text-center py-12">
                  <h2 className="text-xl font-semibold text-white mb-2">Análises</h2>
                  <p className="text-gray-400">Funcionalidade em desenvolvimento...</p>
                </div>
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <ProtectedPage>
                <div className="text-center py-12">
                  <h2 className="text-xl font-semibold text-white mb-2">Configurações</h2>
                  <p className="text-gray-400">Funcionalidade em desenvolvimento...</p>
                </div>
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        {/* Rotas Master */}
        <Route 
          path="/alerts" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <AlertsPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/backup" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <BackupPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/ai-integrations" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <AIIntegrationsPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/security" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <SecurityPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <ReportsPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/templates" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <TemplatesPage />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <UsersPage />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />

        {/* Rota temporariamente desabilitada devido ao arquivo corrompido
        <Route
          path="/admin/learning"
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <LearningPage />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />
        */}

        <Route
          path="/admin/analysis-health"
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <AnalysisHealthDashboard />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/knowledge"
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <KnowledgeManagementPage />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/sector-adapters"
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <SectorAdaptersPage />
              </ProtectedPage>
            </ProtectedRoute>
          }
        />

        <Route
          path="/system" 
          element={
            <ProtectedRoute>
              <ProtectedPage requireMaster={true}>
                <SystemSettings />
              </ProtectedPage>
            </ProtectedRoute>
          } 
        />
        
        {/* Rota do preview (nova aba) */}
        <Route 
          path="/preview/:previewId" 
          element={
            <ProtectedRoute>
              <PreviewPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Fallback para rotas não encontradas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  } catch (error) {
    console.error('Error rendering app:', error)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-xl mb-4">Erro na aplicação</h1>
          <p className="text-gray-400 mb-4">Recarregue a página para tentar novamente</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}

function App() {
  try {
    return (
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    )
  } catch (error) {
    console.error('Critical app error:', error)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-xl mb-4">Erro crítico</h1>
          <p className="text-gray-400">Verifique o console para mais detalhes</p>
        </div>
      </div>
    )
  }
}

export default App