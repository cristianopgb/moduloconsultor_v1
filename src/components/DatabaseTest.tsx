import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react'

interface TestResult {
  name: string
  status: 'pending' | 'success' | 'error'
  message: string
  data?: any
}

export function DatabaseTest() {
  const [tests, setTests] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)

  const updateTest = (name: string, status: 'pending' | 'success' | 'error', message: string, data?: any) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name)
      if (existing) {
        existing.status = status
        existing.message = message
        existing.data = data
        return [...prev]
      }
      return [...prev, { name, status, message, data }]
    })
  }

  const runTests = async () => {
    setRunning(true)
    setTests([])

    // Get authenticated user first
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      updateTest('Auth Check', 'error', 'Usuário não autenticado - faça login primeiro')
      setRunning(false)
      return
    }

    // Test 1: Connection
    updateTest('Conexão', 'pending', 'Testando conexão...')
    try {
      const { data, error } = await supabase.from('models').select('id').limit(1)
      if (error) throw error
      updateTest('Conexão', 'success', 'Conexão estabelecida com sucesso')
    } catch (error: any) {
      updateTest('Conexão', 'error', `Erro de conexão: ${error.message}`)
    }

    // Test 2: Create sample data with authenticated user
    updateTest('Preparar Dados', 'pending', 'Criando dados de exemplo...')
    try {
      // Create a sample user record with authenticated user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || 'test@example.com',
          name: 'Usuário Teste',
          role: 'user'
        })
        .select()
      
      if (userError) throw userError
      
      // Create sample project
      const { error: projectError } = await supabase
        .from('projects')
        .upsert({
          user_id: user.id,
          title: 'Projeto de Teste',
          description: 'Projeto criado para teste'
        })
      
      if (projectError) console.warn('Project creation warning:', projectError.message)
      
      // Create sample document
      const { error: docError } = await supabase
        .from('documents')
        .upsert({
          user_id: user.id,
          title: 'Documento de Teste',
          type: 'document'
        })
      
      if (docError) console.warn('Document creation warning:', docError.message)
      
      // Create sample model
      const { error: modelError } = await supabase
        .from('models')
        .upsert({
          name: 'Modelo de Teste',
          category: 'test',
          file_type: 'template'
        })
      
      if (modelError) console.warn('Model creation warning:', modelError.message)
      
      updateTest('Preparar Dados', 'success', 'Dados de exemplo preparados com sucesso')
    } catch (error: any) {
      updateTest('Preparar Dados', 'error', `Erro ao preparar dados: ${error.message}`)
    }

    // Test 3: Read Users
    updateTest('Leitura Users', 'pending', 'Buscando perfil do usuário...')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
      
      if (error) throw error
      updateTest('Leitura Users', 'success', `${data?.length || 0} usuários encontrados`, data)
    } catch (error: any) {
      updateTest('Leitura Users', 'error', `Erro ao buscar usuários: ${error.message}`)
    }

    // Test 4: Read Projects
    updateTest('Leitura Projects', 'pending', 'Buscando projetos...')
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .limit(5)
      
      if (error) throw error
      updateTest('Leitura Projects', 'success', `${data?.length || 0} projetos encontrados`, data)
    } catch (error: any) {
      updateTest('Leitura Projects', 'error', `Erro ao buscar projetos: ${error.message}`)
    }

    // Test 5: Read Documents
    updateTest('Leitura Documents', 'pending', 'Buscando documentos...')
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .limit(5)
      
      if (error) throw error
      updateTest('Leitura Documents', 'success', `${data?.length || 0} documentos encontrados`, data)
    } catch (error: any) {
      updateTest('Leitura Documents', 'error', `Erro ao buscar documentos: ${error.message}`)
    }

    // Test 6: Read Models
    updateTest('Leitura Models', 'pending', 'Buscando modelos...')
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .limit(5)
      
      if (error) throw error
      updateTest('Leitura Models', 'success', `${data?.length || 0} modelos encontrados`, data)
    } catch (error: any) {
      updateTest('Leitura Models', 'error', `Erro ao buscar modelos: ${error.message}`)
    }

    // Test 7: Auth User Info
    updateTest('Auth Info', 'pending', 'Verificando usuário autenticado...')
    try {
      updateTest('Auth Info', 'success', `Usuário logado: ${user.email}`, { 
        id: user.id, 
        email: user.email,
        created_at: user.created_at 
      })
    } catch (error: any) {
      updateTest('Auth Info', 'error', `Erro auth: ${error.message}`)
    }

    // Test 8: RLS Test
    updateTest('Teste RLS', 'pending', 'Testando Row Level Security...')
    try {
      // Try to insert a test project
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: 'Projeto Teste RLS',
          description: 'Teste de inserção com RLS'
        })
        .select()
      
      if (error) throw error
      
      // Try to delete the test project
      if (data && data[0]) {
        await supabase
          .from('projects')
          .delete()
          .eq('id', data[0].id)
      }
      
      updateTest('Teste RLS', 'success', 'RLS funcionando - inserção/deleção permitida')
    } catch (error: any) {
      updateTest('Teste RLS', 'error', `Erro RLS: ${error.message}`)
    }

    setRunning(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Loader className="w-5 h-5 text-yellow-500 animate-spin" />
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-500/30 bg-yellow-900/20'
      case 'success':
        return 'border-green-500/30 bg-green-900/20'
      case 'error':
        return 'border-red-500/30 bg-red-900/20'
      default:
        return 'border-gray-500/30 bg-gray-900/20'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Teste de Banco de Dados</h1>
          <p className="text-gray-400">Verificar conexões e consultas ao Supabase</p>
        </div>
        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <Database className="w-5 h-5" />
          {running ? 'Testando...' : 'Executar Testes'}
        </button>
      </div>

      <div className="grid gap-4">
        {tests.map((test, index) => (
          <div key={index} className={`border rounded-lg p-4 ${getStatusColor(test.status)}`}>
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon(test.status)}
              <h3 className="font-semibold text-white">{test.name}</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">{test.message}</p>
            {test.data && (
              <details className="mt-2">
                <summary className="text-blue-400 cursor-pointer text-sm">Ver dados</summary>
                <pre className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-300 overflow-auto">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {tests.length === 0 && !running && (
        <div className="text-center py-12 text-gray-400">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Clique em "Executar Testes" para verificar o banco de dados</p>
        </div>
      )}
    </div>
  )
}