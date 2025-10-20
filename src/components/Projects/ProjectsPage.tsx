import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter
} from 'lucide-react'
import { supabase, Project } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProjectModal } from './ProjectModal'
import { ProjectCard } from './ProjectCard'

export function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [error, setError] = useState('')

  /* ───────────── Carregar projetos ───────────── */
  const loadProjects = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao carregar projetos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [user])

  /* ───────────── Filtro de busca ───────────── */
  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  /* ───────────── Criar ───────────── */
  const handleCreateProject = async (projectData: { title: string; description: string }) => {
    if (!user || !user.id) {
      setError('Usuário não autenticado')
      return
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...projectData,
          user_id: user.id  // ✅ Corrigido: inclui o ID do usuário logado
        }])
        .select()

      if (error) throw error

      if (data) {
        setProjects((prev) => [data[0], ...prev])
        setShowModal(false)
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao criar projeto:', err)
    }
  }

  /* ───────────── Editar ───────────── */
  const handleEditProject = async (projectData: { title: string; description: string }) => {
    if (!editingProject) return

    try {
      const { data, error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', editingProject.id)
        .select()

      if (error) throw error

      if (data) {
        setProjects((prev) =>
          prev.map((p) => (p.id === editingProject.id ? data[0] : p))
        )
        setEditingProject(null)
        setShowModal(false)
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao editar projeto:', err)
    }
  }

  /* ───────────── Excluir ───────────── */
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err: any) {
      setError(err.message)
      console.error('Erro ao excluir projeto:', err)
    }
  }

  /* ───────────── Abertura de modal ───────────── */
  const openCreateModal = () => {
    setEditingProject(null)
    setShowModal(true)
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project)
    setShowModal(true)
  }

  /* ───────────── UI ───────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Projetos</h1>
          <p className="text-gray-400">Gerencie seus projetos e processos</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
          <Filter className="w-5 h-5" />
          Filtros
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Grid ou Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {searchTerm ? 'Nenhum projeto encontrado' : 'Nenhum projeto ainda'}
          </h3>
          <p className="text-gray-400 mb-4">
            {searchTerm
              ? 'Tente ajustar sua busca ou criar um novo projeto'
              : 'Comece criando seu primeiro projeto'}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar Primeiro Projeto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => openEditModal(project)}
              onDelete={() => handleDeleteProject(project.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ProjectModal
          project={editingProject}
          onSave={editingProject ? handleEditProject : handleCreateProject}
          onClose={() => {
            setShowModal(false)
            setEditingProject(null)
          }}
        />
      )}
    </div>
  )
}
