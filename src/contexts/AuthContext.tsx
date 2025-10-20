import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, role: 'user' | 'master') => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sessão inicial
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Erro ao obter sessão:', error)
        
        // Check if it's a refresh token error and clear stale session
        if (error instanceof Error && 
            (error.message.includes('Invalid Refresh Token') || 
             error.message.includes('Refresh Token Not Found'))) {
          console.log('Clearing stale session due to invalid refresh token')
          await supabase.auth.signOut()
        }
        
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, role: 'user' | 'master') => {
    console.log('🔄 Iniciando cadastro:', { email, role })
    
    // 1. Criar usuário no Supabase Auth (com trigger automático corrigido)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: email.split('@')[0],
          role: role
        }
      }
    })
    
    if (authError) {
      console.error('❌ Erro no auth:', authError)
      throw authError
    }
    
    if (authData.user) {
      console.log('✅ Usuário criado no auth:', authData.user.id)
      
      // 2. Aguardar trigger processar
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 3. Verificar se foi criado na tabela users pelo trigger
      try {
        const { data: userData, error: checkError } = await supabase
          .from('users')
          .select()
          .eq('id', authData.user.id)
          .single()
        
        if (checkError || !userData) {
          console.log('⚠️ Trigger não criou usuário, criando manualmente...')
          
          // Fallback: criar manualmente se trigger falhou
          const { data: manualUserData, error: manualError } = await supabase
            .from('users')
            .upsert({
              id: authData.user.id,
              email: authData.user.email,
              name: email.split('@')[0],
              role: role
            }, {
              onConflict: 'id'
            })
            .select()
          
          if (manualError) {
            console.error('❌ Erro ao criar usuário manualmente:', manualError)
            throw new Error(`Erro ao salvar dados: ${manualError.message}`)
          }
          
          console.log('✅ Usuário criado manualmente:', manualUserData)
        } else {
          console.log('✅ Usuário criado pelo trigger:', userData)
        }
        
        // 4. Fazer login automático
        await signIn(email, password)
        
      } catch (tableError) {
        console.error('❌ Erro na tabela users:', tableError)
        throw tableError
      }
    }
    
    console.log('🎉 Cadastro concluído com sucesso!')
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}