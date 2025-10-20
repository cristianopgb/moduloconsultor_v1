import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserDashboard } from './Dashboard/UserDashboard'
import { MasterDashboard } from './Dashboard/MasterDashboard'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Dashboard() {
  const { user } = useAuth()

  // Por enquanto, vamos usar dados mock baseados no email
  const isMaster = user?.email?.includes('master') || user?.email?.includes('admin')


  return (
    <div className="space-y-6">
      {/* Botão de volta ao chat */}
      <div className="flex items-center gap-4">
        <Link
          to="/chat"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          Voltar ao Chat
        </Link>
      </div>
      {isMaster ? <MasterDashboard /> : <UserDashboard />}
    </div>
  )
}