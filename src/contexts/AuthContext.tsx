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
    let mounted = true

    // Verificar sessão inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Erro ao obter sessão:', error)

          if (error.message.includes('Invalid Refresh Token') ||
              error.message.includes('Refresh Token Not Found')) {
            console.log('🧹 Limpando sessão inválida...')
            localStorage.removeItem('proceidaia.auth')
            await supabase.auth.signOut({ scope: 'local' })
          }

          if (mounted) setUser(null)
        } else {
          if (mounted) setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Erro inesperado na sessão:', error)
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('proceidaia.auth')
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token atualizado com sucesso')
        }

        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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

    try {
      // 1. Criar usuário no Supabase Auth
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
        throw new Error(`Erro ao criar conta: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('Usuário não foi criado corretamente')
      }

      console.log('✅ Usuário criado no auth:', authData.user.id)

      // 2. Aguardar trigger processar (com retry)
      let retries = 3
      let userData = null

      while (retries > 0 && !userData) {
        await new Promise(resolve => setTimeout(resolve, 1500))

        const { data, error } = await supabase
          .from('users')
          .select()
          .eq('id', authData.user.id)
          .maybeSingle()

        if (!error && data) {
          userData = data
          console.log('✅ Usuário criado pelo trigger:', userData)
          break
        }

        retries--
        if (retries > 0) {
          console.log(`⏳ Aguardando trigger... (${retries} tentativas restantes)`)
        }
      }

      // 3. Fallback: criar manualmente se trigger falhou
      if (!userData) {
        console.log('⚠️ Trigger não criou usuário, criando manualmente...')

        const { data: manualUserData, error: manualError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            email: authData.user.email,
            name: email.split('@')[0],
            role: role,
            tokens_used: 0,
            tokens_limit: role === 'master' ? 999999999 : 100000
          }, {
            onConflict: 'id'
          })
          .select()
          .single()

        if (manualError) {
          console.error('❌ Erro ao criar usuário manualmente:', manualError)
          throw new Error(`Erro ao salvar dados: ${manualError.message}`)
        }

        console.log('✅ Usuário criado manualmente:', manualUserData)
      }

      // 4. Fazer login automático
      await signIn(email, password)

      console.log('🎉 Cadastro concluído com sucesso!')

    } catch (error) {
      console.error('❌ Erro no processo de cadastro:', error)
      throw error
    }
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