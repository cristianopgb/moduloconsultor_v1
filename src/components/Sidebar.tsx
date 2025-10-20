// src/components/Sidebar.tsx
import React from 'react';
import {
  X, MessageSquare, Bot, Layers, FileText, Images, Settings, LayoutTemplate, BookOpen
} from 'lucide-react';

type SidebarProps = {
  collapsed: boolean;               // true = escondido
  onToggle: () => void;             // abre/fecha
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  // largura quando aberto
  const openWidth = 'w-60';
  // quando fechado some (zero), sem ocupar espaço
  const closedWidth = 'w-0';

  return (
    <aside
      className={`relative h-screen bg-gray-950 border-r border-gray-800 overflow-hidden transition-[width] duration-300 ${collapsed ? closedWidth : openWidth}`}
      aria-hidden={collapsed}
    >
      {/* Cabeçalho */}
      <div className="h-12 px-3 border-b border-gray-800 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Menu</div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-gray-800 text-gray-300"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="p-2 space-y-1">
        <SidebarItem icon={<MessageSquare className="w-4 h-4" />} label="Agente (Chat)" />
        <SidebarItem icon={<Bot className="w-4 h-4" />} label="Playbooks / Trilha" />
        <SidebarItem icon={<LayoutTemplate className="w-4 h-4" />} label="Templates" />
        <SidebarItem icon={<FileText className="w-4 h-4" />} label="Documentos" />
        <SidebarItem icon={<Images className="w-4 h-4" />} label="Mídia" />
        <SidebarItem icon={<Layers className="w-4 h-4" />} label="Versões" />
        <SidebarItem icon={<BookOpen className="w-4 h-4" />} label="Guia Rápido" />
        <div className="pt-2 mt-2 border-t border-gray-800">
          <SidebarItem icon={<Settings className="w-4 h-4" />} label="Configurações" />
        </div>
      </nav>
    </aside>
  );
}

function SidebarItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800"
      type="button"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default Sidebar;
